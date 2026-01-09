package workcalendar

import (
	"context"
	"strconv"
	"time"

	"time-attendance-be/internal/authx"
	"time-attendance-be/internal/modules/audit"
	"time-attendance-be/internal/modules/leave"
	"time-attendance-be/internal/pkg/response"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

type Handler struct {
	repo        *Repo
	leaveService *leave.Service
	logger      *zap.Logger
	auditSvc    *audit.Service
}

func NewHandler(repo *Repo, leaveService *leave.Service, logger *zap.Logger, auditSvc *audit.Service) *Handler {
	return &Handler{
		repo:        repo,
		leaveService: leaveService,
		logger:      logger,
		auditSvc:    auditSvc,
	}
}

type generateRequest struct {
	Year int `json:"year" validate:"required,min=2000,max=2100"`
}

// POST /api/v1/admin/work-calendar/generate
// Generate calendar for a given year (Mon-Fri = working day 1.0, weekend off)
func (h *Handler) Generate(c *fiber.Ctx) error {
	adminUser := authx.GetUser(c)
	if adminUser == nil {
		return response.Unauthorized("Unauthorized")
	}

	var req generateRequest
	if err := c.BodyParser(&req); err != nil || req.Year == 0 {
		return response.Validation("Invalid year", nil)
	}

	if err := h.repo.EnsureYear(c.Context(), req.Year); err != nil {
		return response.Internal(err)
	}

	// Log audit
	if h.auditSvc != nil {
		_ = h.auditSvc.LogAdminAction(
			c.Context(),
			adminUser.ID,
			"GENERATE",
			"work_calendar",
			strconv.Itoa(req.Year),
			nil,
			map[string]interface{}{"year": req.Year, "status": "generated"},
			"",
		)
	}

	return response.OK(c, map[string]interface{}{
		"year":   req.Year,
		"status": "generated",
	})
}

type upsertDayRequest struct {
	Date         string  `json:"date" validate:"required"` // YYYY-MM-DD
	IsWorkingDay bool    `json:"isWorkingDay"`
	WorkUnit     float64 `json:"workUnit"` // e.g. 1.0 or 0.5
	Note         *string `json:"note"`
}

// PUT /api/v1/admin/work-calendar/day
// Upsert a specific day override
func (h *Handler) UpsertDay(c *fiber.Ctx) error {
	adminUser := authx.GetUser(c)
	if adminUser == nil {
		return response.Unauthorized("Unauthorized")
	}

	var req upsertDayRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid body", nil)
	}

	d, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		return response.Validation("Invalid date format (YYYY-MM-DD)", nil)
	}
	if req.WorkUnit < 0 || req.WorkUnit > 1.0 {
		return response.Validation("workUnit must be between 0 and 1.0", nil)
	}

	// Get before state
	beforeCal, _ := h.repo.GetByDate(c.Context(), d)
	var before map[string]interface{}
	if beforeCal != nil {
		before = map[string]interface{}{
			"date":         req.Date,
			"isWorkingDay": beforeCal.IsWorkingDay,
			"workUnit":     beforeCal.WorkUnit,
			"note":         beforeCal.Note,
		}
	}

	day := &WorkCalendar{
		WorkDate:     d,
		IsWorkingDay: req.IsWorkingDay,
		WorkUnit:     req.WorkUnit,
		Note:         req.Note,
	}
	if err := h.repo.Upsert(c.Context(), day); err != nil {
		return response.Internal(err)
	}

	after := map[string]interface{}{
		"date":         req.Date,
		"isWorkingDay": req.IsWorkingDay,
		"workUnit":     req.WorkUnit,
		"note":         req.Note,
	}

	// Log audit
	if h.auditSvc != nil {
		_ = h.auditSvc.LogAdminAction(
			c.Context(),
			adminUser.ID,
			"UPDATE",
			"work_calendar",
			req.Date,
			before,
			after,
			"",
		)
	}

	// Recalculate leave_monthly_summary for all users in this month
	// because work calendar change affects expected units calculation
	if h.leaveService != nil {
		year := d.Year()
		month := int(d.Month())
		if err := h.recalculateSummariesForMonth(c.Context(), year, month); err != nil {
			h.logger.Error("failed to recalculate summaries after work calendar update",
				zap.Int("year", year),
				zap.Int("month", month),
				zap.Error(err))
			// Don't fail the request, just log the error
		}
	}

	return response.OK(c, after)
}

// GET /api/v1/admin/work-calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
func (h *Handler) List(c *fiber.Ctx) error {
	fromStr := c.Query("from")
	toStr := c.Query("to")
	
	if fromStr == "" || toStr == "" {
		return response.Validation("from and to query parameters are required (YYYY-MM-DD)", nil)
	}
	
	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		return response.Validation("Invalid from date format (YYYY-MM-DD)", nil)
	}
	
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		return response.Validation("Invalid to date format (YYYY-MM-DD)", nil)
	}
	
	days, err := h.repo.ListRange(c.Context(), from, to)
	if err != nil {
		return response.Internal(err)
	}
	
	// Convert to response format
	result := make([]map[string]interface{}, len(days))
	for i, day := range days {
		result[i] = map[string]interface{}{
			"date":         day.WorkDate.Format("2006-01-02"),
			"isWorkingDay": day.IsWorkingDay,
			"workUnit":     day.WorkUnit,
			"note":         day.Note,
		}
	}
	
	return response.OK(c, result)
}

type bulkUpdateRequest struct {
	Days []upsertDayRequest `json:"days" validate:"required"`
}

// POST /api/v1/admin/work-calendar/bulk
func (h *Handler) BulkUpdate(c *fiber.Ctx) error {
	adminUser := authx.GetUser(c)
	if adminUser == nil {
		return response.Unauthorized("Unauthorized")
	}

	var req bulkUpdateRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid body", nil)
	}
	
	if len(req.Days) == 0 {
		return response.Validation("days array cannot be empty", nil)
	}
	
	// Track unique year-month combinations that were updated
	updatedMonths := make(map[string]struct {
		Year  int
		Month int
	})
	
	// Collect before and after states for audit
	beforeDays := make([]map[string]interface{}, 0, len(req.Days))
	afterDays := make([]map[string]interface{}, 0, len(req.Days))
	
	for _, dayReq := range req.Days {
		d, err := time.Parse("2006-01-02", dayReq.Date)
		if err != nil {
			return response.Validation("Invalid date format in days array (YYYY-MM-DD)", nil)
		}
		if dayReq.WorkUnit < 0 || dayReq.WorkUnit > 1.0 {
			return response.Validation("workUnit must be between 0 and 1.0", nil)
		}
		
		// Get before state
		beforeCal, _ := h.repo.GetByDate(c.Context(), d)
		if beforeCal != nil {
			beforeDays = append(beforeDays, map[string]interface{}{
				"date":         dayReq.Date,
				"isWorkingDay": beforeCal.IsWorkingDay,
				"workUnit":     beforeCal.WorkUnit,
				"note":         beforeCal.Note,
			})
		}
		
		day := &WorkCalendar{
			WorkDate:     d,
			IsWorkingDay: dayReq.IsWorkingDay,
			WorkUnit:     dayReq.WorkUnit,
			Note:         dayReq.Note,
		}
		if err := h.repo.Upsert(c.Context(), day); err != nil {
			return response.Internal(err)
		}
		
		afterDays = append(afterDays, map[string]interface{}{
			"date":         dayReq.Date,
			"isWorkingDay": dayReq.IsWorkingDay,
			"workUnit":     dayReq.WorkUnit,
			"note":         dayReq.Note,
		})
		
		// Track this month for recalculation
		year := d.Year()
		month := int(d.Month())
		key := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC).Format("2006-01")
		updatedMonths[key] = struct {
			Year  int
			Month int
		}{Year: year, Month: month}
	}
	
	// Log audit
	if h.auditSvc != nil {
		_ = h.auditSvc.LogAdminAction(
			c.Context(),
			adminUser.ID,
			"BULK_UPDATE",
			"work_calendar",
			"bulk",
			map[string]interface{}{"days": beforeDays},
			map[string]interface{}{"days": afterDays, "updated": len(req.Days)},
			"",
		)
	}
	
	// Recalculate leave_monthly_summary for all affected months
	if h.leaveService != nil {
		for _, monthInfo := range updatedMonths {
			if err := h.recalculateSummariesForMonth(c.Context(), monthInfo.Year, monthInfo.Month); err != nil {
				h.logger.Error("failed to recalculate summaries after bulk work calendar update",
					zap.Int("year", monthInfo.Year),
					zap.Int("month", monthInfo.Month),
					zap.Error(err))
				// Don't fail the request, just log the error
			}
		}
	}
	
	return response.OK(c, map[string]interface{}{
		"updated": len(req.Days),
	})
}

// recalculateSummariesForMonth recalculates leave_monthly_summary for all users in a specific month
func (h *Handler) recalculateSummariesForMonth(ctx context.Context, year, month int) error {
	if h.leaveService == nil {
		return nil
	}
	
	// Get all user IDs that have summaries for this month
	userIDs, err := h.leaveService.GetUserIDsWithSummaryInMonth(ctx, year, month)
	if err != nil {
		return err
	}
	
	// Recalculate summary for each user
	for _, userID := range userIDs {
		if _, err := h.leaveService.ComputeMonthlySummary(ctx, userID, year, month); err != nil {
			h.logger.Error("failed to recalculate summary for user",
				zap.Uint("userID", userID),
				zap.Int("year", year),
				zap.Int("month", month),
				zap.Error(err))
			// Continue with other users
		}
	}
	
	h.logger.Info("recalculated summaries for month",
		zap.Int("year", year),
		zap.Int("month", month),
		zap.Int("userCount", len(userIDs)))
	
	return nil
}