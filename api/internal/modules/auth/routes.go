package auth

import (
	"time-attendance-be/internal/config"
	platformauth "time-attendance-be/internal/platform/auth"

	"github.com/gofiber/fiber/v2"
)

type Module struct{ h *Handler }

func NewModule(svc *Service, cfg *config.Config) *Module {
	cookies := platformauth.NewCookieManager(cfg)
	return &Module{h: NewHandler(svc, cookies)}
}

func (m *Module) Register(v1 fiber.Router) {
	g := v1.Group("/auth")
	g.Post("/login", m.h.Login)
	g.Post("/logout", m.h.Logout)
	g.Post("/refresh", m.h.Refresh)
}

