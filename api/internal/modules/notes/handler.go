package notes

import (
	"time"

	"time-attendance-be/internal/authx"
	"time-attendance-be/internal/pkg/response"

	"github.com/gofiber/fiber/v2"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// GET /api/v1/notes/me?date=YYYY-MM-DD
func (h *Handler) GetMe(c *fiber.Ctx) error {
	a := authx.GetUser(c)
	if a == nil {
		return response.Unauthorized("Unauthorized")
	}

	dateStr := c.Query("date")
	if dateStr == "" {
		return response.Validation("Missing date", nil)
	}

	note, err := h.svc.GetMe(c.Context(), a.ID, dateStr)
	if err != nil {
		return err
	}

	return response.OK(c, GetMeResponse{WorkDate: note.WorkDate.Format("2006-01-02"), Content: note.Content})
}

// PUT /api/v1/notes/me?date=YYYY-MM-DD
func (h *Handler) PutMe(c *fiber.Ctx) error {
	a := authx.GetUser(c)
	if a == nil {
		return response.Unauthorized("Unauthorized")
	}

	dateStr := c.Query("date")
	if dateStr == "" {
		return response.Validation("Missing date", nil)
	}

	var req PutMeRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid body", nil)
	}

	note, err := h.svc.PutMe(c.Context(), a.ID, dateStr, req.Content)
	if err != nil {
		return err
	}

	updated := note.UpdatedAt
	if updated.IsZero() {
		updated = time.Now()
	}

	return response.OK(c, PutMeResponse{
		WorkDate:  note.WorkDate.Format("2006-01-02"),
		Content:   note.Content,
		UpdatedAt: updated.Format(time.RFC3339),
	})
}

