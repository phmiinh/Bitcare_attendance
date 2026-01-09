package audit

import "github.com/gofiber/fiber/v2"

type Module struct {
	h *Handler
}

func NewModule(repo *Repo) *Module {
	return &Module{
		h: NewHandler(NewService(repo)),
	}
}

func (m *Module) RegisterAdmin(admin fiber.Router) {
	g := admin.Group("/audit")
	g.Get("", m.h.List)
}
