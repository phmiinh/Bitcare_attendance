package auth

import (
	"fmt"
	"time"

	"time-attendance-be/internal/config"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the standard JWT claims plus custom ones.
type Claims struct {
	UserID uint   `json:"uid"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// Manager handles JWT creation and verification.
type Manager struct {
	secret          []byte
	accessTokenTTL  time.Duration
	refreshTokenTTL time.Duration
}

func NewManager(cfg *config.Config) *Manager {
	return &Manager{
		secret:          []byte(cfg.Auth.JWTSecret),
		accessTokenTTL:  cfg.Auth.AccessTokenTTL,
		refreshTokenTTL: cfg.Auth.RefreshTokenTTL,
	}
}

func (m *Manager) GenerateTokens(userID uint, role string) (accessToken, refreshToken string, err error) {
	accessToken, err = m.generateAccessToken(userID, role)
	if err != nil {
		return "", "", err
	}

	refreshToken, err = m.generateRefreshToken(userID, role)
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func (m *Manager) VerifyToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return m.secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("token parsing error: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

func (m *Manager) generateAccessToken(userID uint, role string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(m.accessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "time-attendance-be",
			Subject:   fmt.Sprintf("%d", userID),
			ID:        fmt.Sprintf("access-%d-%d", userID, now.Unix()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

func (m *Manager) generateRefreshToken(userID uint, role string) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(m.refreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			Issuer:    "time-attendance-be",
			Subject:   fmt.Sprintf("%d", userID),
			ID:        fmt.Sprintf("refresh-%d-%d", userID, now.Unix()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(m.secret)
}

















