package middleware

import (
	"strings"

	"time-attendance-be/internal/authx"
	"time-attendance-be/internal/config"
	"time-attendance-be/internal/modules/user"
	"time-attendance-be/internal/pkg/response"
	platformauth "time-attendance-be/internal/platform/auth"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type AuthRequired struct {
	cfg    *config.Config
	jwtMgr *platformauth.Manager
	users  *user.Repo
}

func NewAuthRequired(cfg *config.Config, jwtMgr *platformauth.Manager, users *user.Repo) *AuthRequired {
	return &AuthRequired{cfg: cfg, jwtMgr: jwtMgr, users: users}
}

func (m *AuthRequired) Handle(c *fiber.Ctx) error {
	token := c.Cookies("access_token")
	if token == "" {
		// allow fallback from Authorization header for tooling
		authz := c.Get("Authorization")
		if strings.HasPrefix(authz, "Bearer ") {
			token = strings.TrimPrefix(authz, "Bearer ")
		}
	}

	if token == "" {
		return response.Unauthorized("Unauthorized")
	}

	claims, err := m.jwtMgr.VerifyToken(token)
	if err != nil {
		return response.Unauthorized("Unauthorized")
	}

	u, err := m.users.GetByID(c.Context(), uint(claims.UserID))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.Unauthorized("Unauthorized")
		}
		return response.Internal(err)
	}
	if u.Status != "active" {
		return response.Forbidden("Account disabled")
	}

	c.Locals(authx.CtxUserKey, &authx.User{ID: u.ID, Role: u.Role})
	return c.Next()
}
