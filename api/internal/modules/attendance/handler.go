package attendance

import (
	"encoding/csv"
	"fmt"
	"time"
	"time-attendance-be/internal/authx"
	"time-attendance-be/internal/pkg/response"

	"github.com/gofiber/fiber/v2"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// GET /api/v1/attendance/today
func (h *Handler) Today(c *fiber.Ctx) error {
	a := authx.GetUser(c)
	if a == nil {
		return response.Unauthorized("Unauthorized")
	}

	s, err := h.svc.GetToday(c.Context(), a.ID)
	if err != nil {
		return response.Internal(err)
	}

	loc := h.svc.cfg.TimeLocation()
	if s.Status == "NOT_CHECKED_IN" {
		return response.OK(c, TodayResponse{WorkDate: s.WorkDate.Format("2006-01-02"), Status: "NOT_CHECKED_IN"})
	}

	res := toTodayResponse(s, loc)
	// translate session status to API status for today endpoint
	return response.OK(c, res)
}

// POST /api/v1/attendance/check-in
func (h *Handler) CheckIn(c *fiber.Ctx) error {
	a := authx.GetUser(c)
	if a == nil {
		return response.Unauthorized("Unauthorized")
	}

	s, err := h.svc.CheckIn(c.Context(), a.ID)
	if err != nil {
		// Check error message to return appropriate response
		errMsg := err.Error()
		if errMsg == "already checked in today" {
		return response.Conflict("Already checked in")
		}
		if errMsg == "check-in not allowed outside working hours" {
			return response.Validation("Check-in is only allowed between 08:00 and 18:00", nil)
		}
		// For database errors or other unexpected errors
		return response.Internal(err)
	}

	loc := h.svc.cfg.TimeLocation()
	return response.OK(c, toTodayResponse(s, loc))
}

// GET /api/v1/attendance/me?from=YYYY-MM-DD&to=YYYY-MM-DD
func (h *Handler) ListMe(c *fiber.Ctx) error {
	a := authx.GetUser(c)
	if a == nil {
		return response.Unauthorized("Unauthorized")
	}

	from := c.Query("from")
	to := c.Query("to")

	res, err := h.svc.ListMe(c.Context(), a.ID, from, to)
	if err != nil {
		return response.Internal(err)
	}

	return response.OK(c, res)
}

type checkOutReq struct {
	Reason *string `json:"reason"`
}

// POST /api/v1/attendance/check-out
func (h *Handler) CheckOut(c *fiber.Ctx) error {
	a := authx.GetUser(c)
	if a == nil {
		return response.Unauthorized("Unauthorized")
	}

	var req checkOutReq
	_ = c.BodyParser(&req)

	s, err := h.svc.CheckOut(c.Context(), a.ID, req.Reason)
	if err != nil {
		return response.Conflict(err.Error())
	}

	loc := h.svc.cfg.TimeLocation()
	return response.OK(c, toTodayResponse(s, loc))
}

// Admin handlers
// GET /api/v1/admin/attendance?from=&to=&userId=&departmentId=&status=
func (h *Handler) ListAdmin(c *fiber.Ctx) error {
	filter := AdminListFilter{
		From: c.Query("from"),
		To:   c.Query("to"),
	}

	if userIdStr := c.Query("userId"); userIdStr != "" {
		var userId uint
		if _, err := fmt.Sscanf(userIdStr, "%d", &userId); err == nil {
			filter.UserID = &userId
		}
	}

	if deptIdStr := c.Query("departmentId"); deptIdStr != "" {
		var deptId uint
		if _, err := fmt.Sscanf(deptIdStr, "%d", &deptId); err == nil {
			filter.DepartmentID = &deptId
		}
	}

	if status := c.Query("status"); status != "" {
		filter.Status = &status
	}

	res, err := h.svc.ListAdmin(c.Context(), filter)
	if err != nil {
		return response.Internal(err)
	}

	return response.OK(c, res)
}

// POST /api/v1/admin/attendance
type CreateManualReq struct {
	UserID     uint   `json:"userId"`
	WorkDate   string `json:"workDate"`
	CheckInAt  string `json:"checkInAt"`
	CheckOutAt *string `json:"checkOutAt,omitempty"`
	Reason     string `json:"reason"`
}

func (h *Handler) CreateManual(c *fiber.Ctx) error {
	var req CreateManualReq
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid request body", nil)
	}

	if req.Reason == "" {
		return response.Validation("Reason is required", nil)
	}

	session, err := h.svc.CreateManual(c.Context(), CreateManualRequest{
		UserID:     req.UserID,
		WorkDate:   req.WorkDate,
		CheckInAt:  req.CheckInAt,
		CheckOutAt: req.CheckOutAt,
		Reason:     req.Reason,
	})
	if err != nil {
		return response.Validation(err.Error(), nil)
	}

	loc := h.svc.cfg.TimeLocation()
	return response.OK(c, toTodayResponse(session, loc))
}

// PATCH /api/v1/admin/attendance/:id
type UpdateSessionReq struct {
	CheckInAt  *string `json:"checkInAt,omitempty"`
	CheckOutAt *string `json:"checkOutAt,omitempty"`
	Reason     string  `json:"reason"`
}

func (h *Handler) UpdateSession(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return response.Validation("Invalid session ID", nil)
	}

	var req UpdateSessionReq
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid request body", nil)
	}

	if req.Reason == "" {
		return response.Validation("Reason is required", nil)
	}

	session, err := h.svc.UpdateSession(c.Context(), uint(id), UpdateSessionRequest{
		CheckInAt:  req.CheckInAt,
		CheckOutAt: req.CheckOutAt,
		Reason:     req.Reason,
	})
	if err != nil {
		return response.Validation(err.Error(), nil)
	}

	loc := h.svc.cfg.TimeLocation()
	return response.OK(c, toTodayResponse(session, loc))
}

// POST /api/v1/admin/attendance/:id/close
type CloseSessionReq struct {
	CheckOutAt string `json:"checkOutAt"`
	Reason     string `json:"reason"`
}

func (h *Handler) CloseSession(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return response.Validation("Invalid session ID", nil)
	}

	var req CloseSessionReq
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid request body", nil)
	}

	if req.Reason == "" {
		return response.Validation("Reason is required", nil)
	}

	session, err := h.svc.CloseSession(c.Context(), uint(id), req.CheckOutAt, req.Reason)
	if err != nil {
		return response.Validation(err.Error(), nil)
	}

	loc := h.svc.cfg.TimeLocation()
	return response.OK(c, toTodayResponse(session, loc))
}

// DELETE /api/v1/admin/attendance/:id
func (h *Handler) DeleteSession(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return response.Validation("Invalid session ID", nil)
	}

	if err := h.svc.DeleteSession(c.Context(), uint(id)); err != nil {
		return response.Internal(err)
	}

	// Return a simple success flag to satisfy generic typing of response.OK
	return response.OK(c, true)
}

// GET /api/v1/admin/attendance/export?from=&to=&userId=&departmentId=&status=&format=csv
func (h *Handler) Export(c *fiber.Ctx) error {
	filter := AdminListFilter{
		From: c.Query("from"),
		To:   c.Query("to"),
	}

	if userIdStr := c.Query("userId"); userIdStr != "" {
		var userId uint
		if _, err := fmt.Sscanf(userIdStr, "%d", &userId); err == nil {
			filter.UserID = &userId
		}
	}

	if deptIdStr := c.Query("departmentId"); deptIdStr != "" {
		var deptId uint
		if _, err := fmt.Sscanf(deptIdStr, "%d", &deptId); err == nil {
			filter.DepartmentID = &deptId
		}
	}

	if status := c.Query("status"); status != "" {
		filter.Status = &status
	}

	format := c.Query("format", "csv")
	if format != "csv" {
		return response.Validation("Only CSV format is supported", nil)
	}

	res, err := h.svc.ListAdmin(c.Context(), filter)
	if err != nil {
		return response.Internal(err)
	}

	// Generate CSV
	c.Set("Content-Type", "text/csv; charset=utf-8")
	c.Set("Content-Disposition", fmt.Sprintf("attachment; filename=attendance_%s.csv", time.Now().Format("20060102_150405")))

	writer := csv.NewWriter(c.Response().BodyWriter())
	defer writer.Flush()

	// Write header
	header := []string{"Ngày làm việc", "Nhân viên", "Phòng ban", "Check-in", "Check-out", "Thời gian làm", "Công", "Trạng thái"}
	if err := writer.Write(header); err != nil {
		return response.Internal(err)
	}

	// Write data (using already formatted DTO fields)
	for _, row := range res.Rows {
		workedMinutes := row.WorkedMinutes
		workedHours := workedMinutes / 60
		workedMins := workedMinutes % 60
		workedTime := fmt.Sprintf("%02d:%02d", workedHours, workedMins)

		deptName := row.DepartmentName

		record := []string{
			row.WorkDate,       // already formatted as YYYY-MM-DD
			row.UserName,
			deptName,
			row.CheckInAt,      // already formatted HH:MM:SS
			row.CheckOutAt,     // already formatted HH:MM:SS
			workedTime,
			fmt.Sprintf("%.1f", row.DayUnit),
			row.Status,
		}
		if err := writer.Write(record); err != nil {
			return response.Internal(err)
		}
	}

	return nil
}
