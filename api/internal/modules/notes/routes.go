package notes

import "github.com/gofiber/fiber/v2"

type Module struct{ h *Handler }

func NewModule(svc *Service) *Module { return &Module{h: NewHandler(svc)} }

func (m *Module) RegisterMe(v1 fiber.Router, auth fiber.Handler) {
	g := v1.Group("/notes", auth)
	g.Get("/me", m.h.GetMe)
	g.Put("/me", m.h.PutMe)
}

