package bootstrap

import (
	"time-attendance-be/internal/middleware"
	"time-attendance-be/internal/pkg/response"

	"github.com/gofiber/fiber/v2"
)

func NewServer(c *Container) *fiber.App {
	app := fiber.New(fiber.Config{
		ErrorHandler: response.FiberErrorHandler(c.Logger),
	})

	app.Use(middleware.RequestID())
	app.Use(middleware.Recover(c.Logger))
	app.Use(middleware.CORS(c.Cfg))

	return app
}

















