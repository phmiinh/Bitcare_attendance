package leave

import (
	"strconv"
	"time"

	"time-attendance-be/internal/authx"
	"time-attendance-be/internal/pkg/response"

	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// POST /api/v1/admin/leave/grant
// Manually trigger leave grant for a specific month/year (admin only)
// Body: { "year": 2026, "month": 1 } (optional, defaults to current month)
func (h *Handler) AdminGrantLeave(c *fiber.Ctx) error {
	type GrantRequest struct {
		Year  *int `json:"year"`  // Optional, defaults to current year
		Month *int `json:"month"` // Optional, defaults to current month
	}

	var req GrantRequest
	if err := c.BodyParser(&req); err != nil {
		// If no body provided, use current date
		req = GrantRequest{}
	}

	now := time.Now()
	year := now.Year()
	month := int(now.Month())

	if req.Year != nil {
		year = *req.Year
	}
	if req.Month != nil {
		if *req.Month < 1 || *req.Month > 12 {
			return response.Validation("Month must be between 1 and 12", nil)
		}
		month = *req.Month
	}

	// Temporarily override the date check by creating a custom context
	// We'll modify the service to accept year/month as parameters
	err := h.svc.ProcessLeaveGrantForMonth(c.Context(), year, month)
	if err != nil {
		return response.Internal(err)
	}

	return response.OK(c, map[string]interface{}{
		"message": "Leave grant processed successfully",
		"year":    year,
		"month":   month,
	})
}

// GET /api/v1/me/leave/summary
func (h *Handler) GetMyLeaveSummary(c *fiber.Ctx) error {
	user := authx.GetUser(c)
	if user == nil {
		return response.Unauthorized("Unauthorized")
	}

	now := time.Now()
	year := now.Year()
	month := int(now.Month())
	if y := c.Query("year"); y != "" {
		if yInt, err := strconv.Atoi(y); err == nil {
			year = yInt
		}
	}
	if m := c.Query("month"); m != "" {
		if mInt, err := strconv.Atoi(m); err == nil && mInt >= 1 && mInt <= 12 {
			month = mInt
		}
	}

	summary, err := h.svc.ComputeMonthlySummary(c.Context(), user.ID, year, month)
	if err != nil {
		return response.Internal(err)
	}

	return response.OK(c, LeaveMonthlySummaryResponse{
		UserID:        summary.UserID,
		Year:          summary.Year,
		Month:         summary.Month,
		ExpectedUnits: summary.ExpectedUnits,
		WorkedUnits:   summary.WorkedUnits,
		MissingUnits:  summary.MissingUnits,
		PaidUsedUnits: summary.PaidUsedUnits,
		UnpaidUnits:   summary.UnpaidUnits,
		UpdatedAt:     summary.UpdatedAt,
	})
}

// GET /api/v1/admin/leave/summary?userId=&year=&month=
func (h *Handler) AdminGetLeaveSummary(c *fiber.Ctx) error {
	userIDStr := c.Query("userId")
	if userIDStr == "" {
		return response.Validation("userId is required", nil)
	}
	userID64, err := strconv.ParseUint(userIDStr, 10, 64)
	if err != nil {
		return response.Validation("invalid userId", nil)
	}
	userID := uint(userID64)

	now := time.Now()
	year := now.Year()
	month := int(now.Month())
	if y := c.Query("year"); y != "" {
		if yInt, err := strconv.Atoi(y); err == nil {
			year = yInt
		}
	}
	if m := c.Query("month"); m != "" {
		if mInt, err := strconv.Atoi(m); err == nil && mInt >= 1 && mInt <= 12 {
			month = mInt
		}
	}

	summary, err := h.svc.ComputeMonthlySummary(c.Context(), userID, year, month)
	if err != nil {
		return response.Internal(err)
	}

	return response.OK(c, LeaveMonthlySummaryResponse{
		UserID:        summary.UserID,
		Year:          summary.Year,
		Month:         summary.Month,
		ExpectedUnits: summary.ExpectedUnits,
		WorkedUnits:   summary.WorkedUnits,
		MissingUnits:  summary.MissingUnits,
		PaidUsedUnits: summary.PaidUsedUnits,
		UnpaidUnits:   summary.UnpaidUnits,
		UpdatedAt:     summary.UpdatedAt,
	})
}

// GET /api/v1/me/leave/stats
// Get leave statistics for current user (total leave days in current month)
func (h *Handler) GetLeaveStats(c *fiber.Ctx) error {
	user := authx.GetUser(c)
	if user == nil {
		return response.Unauthorized("Unauthorized")
	}

	now := time.Now()
	year := now.Year()
	month := int(now.Month())

	if y := c.Query("year"); y != "" {
		if yInt, err := strconv.Atoi(y); err == nil {
			year = yInt
		}
	}
	if m := c.Query("month"); m != "" {
		if mInt, err := strconv.Atoi(m); err == nil && mInt >= 1 && mInt <= 12 {
			month = mInt
		}
	}

	total, err := h.svc.GetTotalDaysUsedInMonth(c.Context(), user.ID, year, month)
	if err != nil {
		return response.Internal(err)
	}

	return response.OK(c, map[string]interface{}{
		"year":  year,
		"month": month,
		"total": total,
	})
}

// GET /api/v1/admin/leave/summaries?year=&month=&userId=&departmentId=
func (h *Handler) AdminListSummaries(c *fiber.Ctx) error {
	now := time.Now()
	year := now.Year()
	month := int(now.Month())
	
	if y := c.Query("year"); y != "" {
		if yInt, err := strconv.Atoi(y); err == nil {
			year = yInt
		}
	}
	if m := c.Query("month"); m != "" {
		if mInt, err := strconv.Atoi(m); err == nil && mInt >= 1 && mInt <= 12 {
			month = mInt
		}
	}
	
	var userID *uint
	if userIdStr := c.Query("userId"); userIdStr != "" {
		if userId64, err := strconv.ParseUint(userIdStr, 10, 64); err == nil {
			uid := uint(userId64)
			userID = &uid
		}
	}
	
	var departmentID *uint
	if deptIdStr := c.Query("departmentId"); deptIdStr != "" {
		if deptId64, err := strconv.ParseUint(deptIdStr, 10, 64); err == nil {
			did := uint(deptId64)
			departmentID = &did
		}
	}
	
	summaries, err := h.svc.ListMonthlySummaries(c.Context(), year, month, userID, departmentID)
	if err != nil {
		return response.Internal(err)
	}
	
	results := make([]LeaveMonthlySummaryResponse, len(summaries))
	for i, s := range summaries {
		results[i] = LeaveMonthlySummaryResponse{
			UserID:        s.UserID,
			Year:          s.Year,
			Month:         s.Month,
			ExpectedUnits: s.ExpectedUnits,
			WorkedUnits:   s.WorkedUnits,
			MissingUnits:  s.MissingUnits,
			PaidUsedUnits: s.PaidUsedUnits,
			UnpaidUnits:   s.UnpaidUnits,
			UpdatedAt:     s.UpdatedAt,
		}
	}
	
	return response.OK(c, results)
}

// POST /api/v1/admin/leave/summary/recalculate?userId=&year=&month=
func (h *Handler) AdminRecalculateSummary(c *fiber.Ctx) error {
	userIDStr := c.Query("userId")
	if userIDStr == "" {
		return response.Validation("userId is required", nil)
	}
	userID64, err := strconv.ParseUint(userIDStr, 10, 64)
	if err != nil {
		return response.Validation("invalid userId", nil)
	}
	userID := uint(userID64)
	
	now := time.Now()
	year := now.Year()
	month := int(now.Month())
	if y := c.Query("year"); y != "" {
		if yInt, err := strconv.Atoi(y); err == nil {
			year = yInt
		}
	}
	if m := c.Query("month"); m != "" {
		if mInt, err := strconv.Atoi(m); err == nil && mInt >= 1 && mInt <= 12 {
			month = mInt
		}
	}
	
	summary, err := h.svc.ComputeMonthlySummary(c.Context(), userID, year, month)
	if err != nil {
		return response.Internal(err)
	}
	
	return response.OK(c, LeaveMonthlySummaryResponse{
		UserID:        summary.UserID,
		Year:          summary.Year,
		Month:         summary.Month,
		ExpectedUnits: summary.ExpectedUnits,
		WorkedUnits:   summary.WorkedUnits,
		MissingUnits:  summary.MissingUnits,
		PaidUsedUnits: summary.PaidUsedUnits,
		UnpaidUnits:   summary.UnpaidUnits,
		UpdatedAt:     summary.UpdatedAt,
	})
}

// GET /api/v1/admin/leave/grants?year=&month=
func (h *Handler) AdminListGrants(c *fiber.Ctx) error {
	grants, err := h.svc.ListGrants(c.Context())
	if err != nil {
		return response.Internal(err)
	}
	
	results := make([]map[string]interface{}, len(grants))
	for i, g := range grants {
		results[i] = map[string]interface{}{
			"id":        g.ID,
			"grantYear": g.GrantYear,
			"grantMonth": g.GrantMonth,
			"grantType": g.GrantType,
			"createdAt": g.CreatedAt,
		}
	}
	
	return response.OK(c, results)
}

// PATCH /api/v1/admin/leave/summary/:userId/:year/:month
// Adjust paid_leave for a user (updates user.paid_leave and recomputes summary)
type AdjustPaidLeaveRequest struct {
	PaidLeave float64 `json:"paidLeave" validate:"required"`
	Reason    string  `json:"reason" validate:"required"`
}

func (h *Handler) AdminAdjustPaidLeave(c *fiber.Ctx) error {
	userIDStr := c.Params("userId")
	yearStr := c.Params("year")
	monthStr := c.Params("month")
	
	userID64, err := strconv.ParseUint(userIDStr, 10, 64)
	if err != nil {
		return response.Validation("invalid userId", nil)
	}
	userID := uint(userID64)
	
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		return response.Validation("invalid year", nil)
	}
	
	month, err := strconv.Atoi(monthStr)
	if err != nil || month < 1 || month > 12 {
		return response.Validation("invalid month", nil)
	}
	
	var req AdjustPaidLeaveRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid body", nil)
	}
	
	if req.Reason == "" {
		return response.Validation("reason is required", nil)
	}
	
	// Update user's paid_leave via service
	if err := h.svc.AdjustUserPaidLeave(c.Context(), userID, req.PaidLeave); err != nil {
		return response.Internal(err)
	}
	
	// Recompute summary
	summary, err := h.svc.ComputeMonthlySummary(c.Context(), userID, year, month)
	if err != nil {
		return response.Internal(err)
	}
	
	return response.OK(c, LeaveMonthlySummaryResponse{
		UserID:        summary.UserID,
		Year:          summary.Year,
		Month:         summary.Month,
		ExpectedUnits: summary.ExpectedUnits,
		WorkedUnits:   summary.WorkedUnits,
		MissingUnits:  summary.MissingUnits,
		PaidUsedUnits: summary.PaidUsedUnits,
		UnpaidUnits:   summary.UnpaidUnits,
		UpdatedAt:     summary.UpdatedAt,
	})
}
