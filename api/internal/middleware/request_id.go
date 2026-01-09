package middleware

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const RequestIDKey = "request_id"

func RequestID() fiber.Handler {
	return func(c *fiber.Ctx) error {
		rid := c.Get("X-Request-Id")
		if rid == "" {
			rid = uuid.NewString()
		}
		c.Locals(RequestIDKey, rid)
		c.Set("X-Request-Id", rid)
		return c.Next()
	}
}

















