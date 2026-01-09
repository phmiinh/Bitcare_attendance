package user

import (
	"time-attendance-be/internal/modules/audit"

	"github.com/gofiber/fiber/v2"
)

type Module struct{ h *Handler }

func NewModule(svc *Service, auditSvc *audit.Service) *Module {
	return &Module{h: NewHandler(svc, auditSvc)}
}

func (m *Module) RegisterMe(v1 fiber.Router, auth fiber.Handler) {
	v1.Get("/me", auth, m.h.Me)
}

func (m *Module) RegisterAdmin(admin fiber.Router) {
	g := admin.Group("/users")
	g.Get("/", m.h.AdminList)
	g.Post("/", m.h.AdminCreate)
	g.Get("/:id", m.h.AdminGet)
	g.Patch("/:id", m.h.AdminUpdate)
	g.Delete("/:id", m.h.AdminDelete)
}

















