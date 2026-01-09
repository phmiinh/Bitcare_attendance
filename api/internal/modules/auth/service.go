package auth

import (
	"context"

	"time-attendance-be/internal/config"
	"time-attendance-be/internal/modules/user"
	"time-attendance-be/internal/pkg/response"
	"time-attendance-be/internal/pkg/security"
	platformauth "time-attendance-be/internal/platform/auth"

	"gorm.io/gorm"
)

type Service struct {
	userRepo *user.Repo
	jwtMgr   *platformauth.Manager
	cookies  *platformauth.CookieManager
}

func NewService(cfg *config.Config, userRepo *user.Repo, jwtMgr *platformauth.Manager) *Service {
	return &Service{
		userRepo: userRepo,
		jwtMgr:   jwtMgr,
		cookies:  platformauth.NewCookieManager(cfg),
	}
}

func (s *Service) Login(ctx context.Context, email, password string) (*user.User, string, string, error) {
	u, err := s.userRepo.GetByEmail(ctx, email)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, "", "", response.Unauthorized("Invalid credentials")
		}
		return nil, "", "", response.Internal(err)
	}

	if !u.IsActive() {
		return nil, "", "", response.Forbidden("Account is disabled")
	}

	if err := security.ComparePassword(u.PasswordHash, password); err != nil {
		return nil, "", "", response.Unauthorized("Invalid credentials")
	}

	accessToken, refreshToken, err := s.jwtMgr.GenerateTokens(u.ID, u.Role)
	if err != nil {
		return nil, "", "", response.Internal(err)
	}

	return u, accessToken, refreshToken, nil
}

func (s *Service) RefreshToken(ctx context.Context, refreshToken string) (uint, string, string, error) {
	claims, err := s.jwtMgr.VerifyToken(refreshToken)
	if err != nil {
		return 0, "", "", response.Unauthorized("Invalid refresh token")
	}

	u, err := s.userRepo.GetByID(ctx, uint(claims.UserID))
	if err != nil {
		return 0, "", "", response.Unauthorized("User not found")
	}

	if !u.IsActive() {
		return 0, "", "", response.Forbidden("Account is disabled")
	}

	accessToken, newRefreshToken, err := s.jwtMgr.GenerateTokens(u.ID, u.Role)
	if err != nil {
		return 0, "", "", response.Internal(err)
	}

	return u.ID, accessToken, newRefreshToken, nil
}
