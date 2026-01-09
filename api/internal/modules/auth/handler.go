package auth

import (
	"time-attendance-be/internal/pkg/response"
	platformauth "time-attendance-be/internal/platform/auth"

	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	svc     *Service
	cookies *platformauth.CookieManager
}

func NewHandler(svc *Service, cookies *platformauth.CookieManager) *Handler {
	return &Handler{svc: svc, cookies: cookies}
}

// POST /api/v1/auth/login
func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid body", nil)
	}

	u, accessToken, refreshToken, err := h.svc.Login(c.Context(), req.Email, req.Password)
	if err != nil {
		return err
	}

	h.cookies.SetAccessToken(c, accessToken)
	h.cookies.SetRefreshToken(c, refreshToken)

	return response.OK(c, LoginResponse{User: LoginUser{ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role}})
}

// POST /api/v1/auth/logout
func (h *Handler) Logout(c *fiber.Ctx) error {
	h.cookies.ClearTokens(c)
	return response.OK(c, true)
}

// POST /api/v1/auth/refresh
func (h *Handler) Refresh(c *fiber.Ctx) error {
	rt := c.Cookies("refresh_token")
	if rt == "" {
		return response.Unauthorized("Unauthorized")
	}

	_, accessToken, newRefreshToken, err := h.svc.RefreshToken(c.Context(), rt)
	if err != nil {
		return err
	}

	h.cookies.SetAccessToken(c, accessToken)
	h.cookies.SetRefreshToken(c, newRefreshToken)

	return response.OK(c, true)
}

