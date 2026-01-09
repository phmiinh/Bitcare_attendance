package stats

import (
	"time"

	"time-attendance-be/internal/authx"
	"time-attendance-be/internal/pkg/response"

	"github.com/gofiber/fiber/v2"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// GET /api/v1/stats/me?month=YYYY-MM OR year=YYYY
// If no query param provided, defaults to current month
func (h *Handler) GetMeStats(c *fiber.Ctx) error {
	a := authx.GetUser(c)
	if a == nil {
		return response.Unauthorized("Unauthorized")
	}

	var queryRange, value string
	if month := c.Query("month"); month != "" {
		queryRange = "month"
		value = month
	} else if year := c.Query("year"); year != "" {
		queryRange = "year"
		value = year
	} else {
		// Default to current month if no query param provided
		now := time.Now().In(h.svc.cfg.TimeLocation())
		queryRange = "month"
		value = now.Format("2006-01")
	}

	stats, err := h.svc.GetMeStats(c.Context(), a.ID, queryRange, value)
	if err != nil {
		return err
	}

	return response.OK(c, stats)
}

// GET /api/v1/admin/overview/today
func (h *Handler) GetTodayOps(c *fiber.Ctx) error {
	ops, err := h.svc.GetTodayOps(c.Context())
	if err != nil {
		return err
	}
	return response.OK(c, ops)
}

// GET /api/v1/admin/overview/top-issues
func (h *Handler) GetTopIssues(c *fiber.Ctx) error {
	issues, err := h.svc.GetTopIssues(c.Context())
	if err != nil {
		return err
	}
	return response.OK(c, issues)
}
