package bootstrap

import (
	"time-attendance-be/internal/app/health"

	"github.com/gofiber/fiber/v2"
)

func RegisterRoutes(app *fiber.App, c *Container) {
	// Health
	health.Register(app)

	v1 := app.Group("/api/v1")

	// Auth
	c.Auth.Register(v1)

	// Me
	c.Users.RegisterMe(v1, c.AuthRequired.Handle)

	// User features
	c.Attendance.RegisterMe(v1, c.AuthRequired.Handle)
	c.Notes.RegisterMe(v1, c.AuthRequired.Handle)
	c.Stats.RegisterMe(v1, c.AuthRequired.Handle)
	c.Leave.RegisterMe(v1, c.AuthRequired.Handle)

	// Admin
	admin := v1.Group("/admin", c.AuthRequired.Handle, c.AdminRequired.Handle)
	c.Users.RegisterAdmin(admin)
	c.Departments.RegisterAdmin(admin)
	c.Attendance.RegisterAdmin(admin)
	c.Stats.RegisterAdmin(admin)
	c.Leave.RegisterAdmin(admin)
	c.WorkCalendar.RegisterAdmin(admin)
	c.Audit.RegisterAdmin(admin)
}
