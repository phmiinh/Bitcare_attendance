package stats

import (
	"time-attendance-be/internal/config"
	"time-attendance-be/internal/pkg/clock"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type Module struct{ h *Handler }

func NewModule(cfg *config.Config, db *gorm.DB, clock clock.Clock) *Module {
	repo := NewRepo(db)
	svc := NewService(cfg, repo, clock)
	return &Module{h: NewHandler(svc)}
}

func (m *Module) RegisterMe(v1 fiber.Router, auth fiber.Handler) {
	g := v1.Group("/stats", auth)
	g.Get("/me", m.h.GetMeStats)
}

func (m *Module) RegisterAdmin(admin fiber.Router) {
	overview := admin.Group("/overview")
	overview.Get("/today", m.h.GetTodayOps)
	overview.Get("/top-issues", m.h.GetTopIssues)
}

