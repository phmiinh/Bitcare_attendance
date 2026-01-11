package config

import "time"

func defaultConfig() Config {
	return Config{
		Env:      "development",
		HTTPAddr: ":8080",

		AppTZ: "Asia/Bangkok",

		DefaultAdminEmail:    "admin@local.test",
		DefaultAdminPassword: "Admin@12345",

		DB: DBConfig{
			Host:     "127.0.0.1",
			Port:     3306,
			User:     "root",
			Password: "",
			Name:     "time_attendance",
			// Thêm timeout settings để tránh query bị treo
			Params:   "charset=utf8mb4&parseTime=True&loc=Local&timeout=10s&readTimeout=30s&writeTimeout=30s",
		},

		CORSAllowOrigins: "http://localhost:3000",

		Auth: AuthConfig{
			JWTSecret:            "change-me",
			AccessTokenTTL:       15 * time.Minute,
			RefreshTokenTTL:      7 * 24 * time.Hour,
			CookieSecure:         false,
			CookieSameSite:       "Lax",
			CheckoutGraceDays:    2,
			AuthRateLimitEnabled: true,
			AuthRateLimitMax:     20,
			AuthRateLimitWindow:  60 * time.Second,
		},
	}
}
