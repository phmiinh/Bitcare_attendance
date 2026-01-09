package authx

import "github.com/gofiber/fiber/v2"

// User represents the essential user information stored in the context.
// This is a stripped-down version to break import cycles.
type User struct {
	ID   uint
	Role string
}

const CtxUserKey = "auth_user"

// GetUser retrieves the authenticated user from the context.
func GetUser(c *fiber.Ctx) *User {
	v := c.Locals(CtxUserKey)
	if v == nil {
		return nil
	}
	u, _ := v.(*User)
	return u
}

