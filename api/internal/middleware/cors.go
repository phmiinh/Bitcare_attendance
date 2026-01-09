package middleware

import (
	"strings"

	"time-attendance-be/internal/config"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
)

func CORS(cfg *config.Config) fiber.Handler {
	origins := cfg.CORSAllowOrigins
	if origins == "" {
		origins = "http://localhost:3000"
	}
	// Allow multiple origins separated by comma.
	origins = strings.Join(splitAndTrim(origins), ",")

	return cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept",
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
	})
}

func splitAndTrim(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

















