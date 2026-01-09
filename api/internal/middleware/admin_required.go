package middleware

import (
	"time-attendance-be/internal/authx"
	"time-attendance-be/internal/pkg/response"

	"github.com/gofiber/fiber/v2"
)

type AdminRequired struct{}

func NewAdminRequired() *AdminRequired { return &AdminRequired{} }

func (m *AdminRequired) Handle(c *fiber.Ctx) error {
	u := authx.GetUser(c)
	if u == nil {
		return response.Unauthorized("Unauthorized")
	}
	if u.Role != "admin" {
		return response.Forbidden("Forbidden")
	}
	return c.Next()
}
