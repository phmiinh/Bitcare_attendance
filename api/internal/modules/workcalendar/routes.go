package workcalendar

import (
	"time-attendance-be/internal/modules/audit"
	"time-attendance-be/internal/modules/leave"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

type Module struct {
	h *Handler
}

func NewModule(repo *Repo, leaveService *leave.Service, logger *zap.Logger, auditSvc *audit.Service) *Module {
	return &Module{
		h: NewHandler(repo, leaveService, logger, auditSvc),
	}
}

func (m *Module) RegisterAdmin(admin fiber.Router) {
	g := admin.Group("/work-calendar")
	g.Get("", m.h.List)
	g.Post("/generate", m.h.Generate)
	g.Put("/day", m.h.UpsertDay)
	g.Post("/bulk", m.h.BulkUpdate)
}

