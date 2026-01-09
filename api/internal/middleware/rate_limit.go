package middleware

import (
	"time"

	"time-attendance-be/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
)

func AuthRateLimit(cfg *config.Config) fiber.Handler {
	return limiter.New(limiter.Config{
		Max:        cfg.Auth.AuthRateLimitMax,
		Expiration: cfg.Auth.AuthRateLimitWindow,
		KeyGenerator: func(c *fiber.Ctx) string {
			// Use IP as key; in production consider X-Forwarded-For config.
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(429).JSON(fiber.Map{
				"error": fiber.Map{
					"code":    "rate_limited",
					"message": "Too many requests",
				},
			})
		},
	})
}

func DurationSeconds(sec int) time.Duration {
	return time.Duration(sec) * time.Second
}

















