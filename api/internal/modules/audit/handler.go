package audit

import (
	"strconv"
	"time"

	"time-attendance-be/internal/pkg/response"

	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

// GET /api/v1/admin/audit?adminUserId=&entityType=&entityId=&actionType=&from=&to=&limit=&offset=
func (h *Handler) List(c *fiber.Ctx) error {
	filter := AuditFilter{}

	if adminUserIdStr := c.Query("adminUserId"); adminUserIdStr != "" {
		if id, err := strconv.ParseUint(adminUserIdStr, 10, 64); err == nil {
			uid := uint(id)
			filter.AdminUserID = &uid
		}
	}

	if entityType := c.Query("entityType"); entityType != "" {
		filter.EntityType = &entityType
	}

	if entityId := c.Query("entityId"); entityId != "" {
		filter.EntityID = &entityId
	}

	if actionType := c.Query("actionType"); actionType != "" {
		filter.ActionType = &actionType
	}

	if fromStr := c.Query("from"); fromStr != "" {
		if from, err := time.Parse("2006-01-02", fromStr); err == nil {
			filter.From = &from
		}
	}

	if toStr := c.Query("to"); toStr != "" {
		if to, err := time.Parse("2006-01-02", toStr); err == nil {
			to = to.Add(24 * time.Hour)
			filter.To = &to
		}
	}

	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}
	filter.Limit = limit

	offset := 0
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}
	filter.Offset = offset

	logs, total, err := h.svc.ListLogs(c.Context(), filter)
	if err != nil {
		return response.Internal(err)
	}

	return response.OK(c, map[string]interface{}{
		"items": logs,
		"total": total,
		"limit": limit,
		"offset": offset,
	})
}
