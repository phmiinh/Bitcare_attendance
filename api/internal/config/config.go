package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Config struct {
	Env                  string
	HTTPAddr             string
	AppTZ                string
	DefaultAdminEmail    string
	DefaultAdminPassword string

	DB               DBConfig
	CORSAllowOrigins string
	Auth             AuthConfig
}

type DBConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	Params   string
}

type AuthConfig struct {
	JWTSecret            string
	AccessTokenTTL       time.Duration
	RefreshTokenTTL      time.Duration
	CookieSecure         bool
	CookieSameSite       string
	CheckoutGraceDays    int
	AuthRateLimitEnabled bool
	AuthRateLimitMax     int
	AuthRateLimitWindow  time.Duration
}

// Load builds a Config instance by starting with the hard-coded defaults and then overriding
// any field that has a corresponding environment variable set. This removes the dependency
// on github.com/spf13/viper and makes the configuration mechanism fully transparent.
func Load() *Config {
	cfg := defaultConfig()

	setStr := func(env string, dst *string) {
		if v := os.Getenv(env); v != "" {
			*dst = v
		}
	}
	setInt := func(env string, dst *int) {
		if v := os.Getenv(env); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				*dst = n
			}
		}
	}
	setBool := func(env string, dst *bool) {
		if v := os.Getenv(env); v != "" {
			if b, err := strconv.ParseBool(v); err == nil {
				*dst = b
			}
		}
	}
	setDur := func(env string, dst *time.Duration) {
		if v := os.Getenv(env); v != "" {
			if d, err := time.ParseDuration(v); err == nil {
				*dst = d
			}
		}
	}

	// top level
	setStr("ENV", &cfg.Env)
	setStr("HTTP_ADDR", &cfg.HTTPAddr)
	setStr("APP_TZ", &cfg.AppTZ)
	setStr("DEFAULT_ADMIN_EMAIL", &cfg.DefaultAdminEmail)
	setStr("DEFAULT_ADMIN_PASSWORD", &cfg.DefaultAdminPassword)

	// DB
	setStr("DB_HOST", &cfg.DB.Host)
	setInt("DB_PORT", &cfg.DB.Port)
	setStr("DB_USER", &cfg.DB.User)
	setStr("DB_PASSWORD", &cfg.DB.Password)
	setStr("DB_NAME", &cfg.DB.Name)
	setStr("DB_PARAMS", &cfg.DB.Params)

	// CORS
	setStr("CORS_ALLOW_ORIGINS", &cfg.CORSAllowOrigins)

	// Auth
	setStr("AUTH_JWT_SECRET", &cfg.Auth.JWTSecret)
	setDur("AUTH_ACCESS_TOKEN_TTL", &cfg.Auth.AccessTokenTTL)
	setDur("AUTH_REFRESH_TOKEN_TTL", &cfg.Auth.RefreshTokenTTL)
	setBool("AUTH_COOKIE_SECURE", &cfg.Auth.CookieSecure)
	setStr("AUTH_COOKIE_SAME_SITE", &cfg.Auth.CookieSameSite)
	setInt("AUTH_CHECKOUT_GRACE_DAYS", &cfg.Auth.CheckoutGraceDays)
	setBool("AUTH_AUTH_RATE_LIMIT_ENABLED", &cfg.Auth.AuthRateLimitEnabled)
	setInt("AUTH_AUTH_RATE_LIMIT_MAX", &cfg.Auth.AuthRateLimitMax)
	setDur("AUTH_AUTH_RATE_LIMIT_WINDOW", &cfg.Auth.AuthRateLimitWindow)

	return &cfg
}

// ----------------------------------------------------------------------------
// Convenience methods
// ----------------------------------------------------------------------------

// TimeLocation returns *time.Location corresponding to AppTZ or UTC on error.
func (c *Config) TimeLocation() *time.Location {
	loc, err := time.LoadLocation(c.AppTZ)
	if err != nil {
		return time.UTC
	}
	return loc
}

// DSN returns MySQL DSN constructed from the DB sub-config.
func (c *Config) DSN() string {
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?%s",
		c.DB.User,
		c.DB.Password,
		c.DB.Host,
		c.DB.Port,
		c.DB.Name,
		c.DB.Params,
	)
}

// DSNRedacted is like DSN but hides the password for safe logging.
func (c *Config) DSNRedacted() string {
	pwd := c.DB.Password
	if pwd != "" {
		pwd = ""
	}
	return fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?%s",
		c.DB.User,
		pwd,
		c.DB.Host,
		c.DB.Port,
		c.DB.Name,
		c.DB.Params,
	)
}

func (c *Config) IsDevelopment() bool { return c.Env == "development" }
func (c *Config) IsProduction() bool  { return c.Env == "production" }
