package attendance

import (
	"github.com/gofiber/fiber/v2"
)

type Module struct{ h *Handler }

func NewModule(svc *Service) *Module { return &Module{h: NewHandler(svc)} }

func (m *Module) RegisterMe(v1 fiber.Router, auth fiber.Handler) {
	g := v1.Group("/attendance", auth)
	g.Get("/today", m.h.Today)
	g.Post("/check-in", m.h.CheckIn)
	g.Post("/check-out", m.h.CheckOut)
	g.Get("/me", m.h.ListMe)
}

func (m *Module) RegisterAdmin(admin fiber.Router) {
	g := admin.Group("/attendance")
	g.Get("", m.h.ListAdmin)
	g.Get("/export", m.h.Export)
	g.Post("", m.h.CreateManual)
	g.Patch("/:id", m.h.UpdateSession)
	g.Post("/:id/close", m.h.CloseSession)
	g.Delete("/:id", m.h.DeleteSession)
}

