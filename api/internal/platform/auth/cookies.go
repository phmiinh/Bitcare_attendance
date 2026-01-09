package auth

import (
	"time"

	"time-attendance-be/internal/config"

	"github.com/gofiber/fiber/v2"
)

type CookieManager struct {
	cfg *config.Config
}

func NewCookieManager(cfg *config.Config) *CookieManager {
	return &CookieManager{cfg: cfg}
}

func (cm *CookieManager) SetAccessToken(c *fiber.Ctx, token string) {
	cm.setCookie(c, "access_token", token, cm.cfg.Auth.AccessTokenTTL)
}

func (cm *CookieManager) SetRefreshToken(c *fiber.Ctx, token string) {
	cm.setCookie(c, "refresh_token", token, cm.cfg.Auth.RefreshTokenTTL)
}

func (cm *CookieManager) ClearTokens(c *fiber.Ctx) {
	cm.clearCookie(c, "access_token")
	cm.clearCookie(c, "refresh_token")
}

func (cm *CookieManager) setCookie(c *fiber.Ctx, name, value string, ttl time.Duration) {
	cookie := new(fiber.Cookie)
	cookie.Name = name
	cookie.Value = value
	cookie.Expires = time.Now().Add(ttl)
	cookie.HTTPOnly = true
	cookie.Secure = cm.cfg.Auth.CookieSecure
	cookie.Path = "/"
	cookie.SameSite = parseSameSite(cm.cfg.Auth.CookieSameSite)
	c.Cookie(cookie)
}

func (cm *CookieManager) clearCookie(c *fiber.Ctx, name string) {
	cookie := new(fiber.Cookie)
	cookie.Name = name
	cookie.Value = ""
	cookie.Expires = time.Unix(0, 0)
	cookie.HTTPOnly = true
	cookie.Secure = cm.cfg.Auth.CookieSecure
	cookie.Path = "/"
	cookie.SameSite = parseSameSite(cm.cfg.Auth.CookieSameSite)
	c.Cookie(cookie)
}

func parseSameSite(v string) string {
	switch v {
	case "Strict", "strict":
		return "Strict"
	case "None", "none":
		return "None"
	default:
		return "Lax"
	}
}

















