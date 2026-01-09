package leave

import (
	"github.com/gofiber/fiber/v2"
)

type Module struct {
	h *Handler
	s *Service
}

func NewModule(svc *Service) *Module {
	return &Module{h: NewHandler(svc), s: svc}
}

func (m *Module) Service() *Service {
	return m.s
}

func (m *Module) RegisterMe(v1 fiber.Router, auth fiber.Handler) {
	g := v1.Group("/me/leave", auth)
	g.Get("/summary", m.h.GetMyLeaveSummary)
}

func (m *Module) RegisterAdmin(admin fiber.Router) {
	g := admin.Group("/leave")
	g.Post("/grant", m.h.AdminGrantLeave)
	g.Get("/summary", m.h.AdminGetLeaveSummary)
	g.Get("/summaries", m.h.AdminListSummaries)
	g.Post("/summary/recalculate", m.h.AdminRecalculateSummary)
	g.Patch("/summary/:userId/:year/:month", m.h.AdminAdjustPaidLeave)
	g.Get("/grants", m.h.AdminListGrants)
}

