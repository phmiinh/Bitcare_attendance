package department

import "github.com/gofiber/fiber/v2"

type Module struct{ h *Handler }

func NewModule(svc *Service) *Module { return &Module{h: NewHandler(svc)} }

func (m *Module) RegisterAdmin(admin fiber.Router) {
	g := admin.Group("/departments")
	g.Get("/", m.h.List)
	g.Post("/", m.h.Create)
	g.Patch("/:id", m.h.Update)
	g.Delete("/:id", m.h.Delete)
}

















