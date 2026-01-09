package health

import "github.com/gofiber/fiber/v2"

func Register(app *fiber.App) {
	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})
	app.Get("/readyz", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})
}

















