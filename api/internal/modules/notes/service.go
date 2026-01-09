package notes

import (
	"context"
	"time"

	"time-attendance-be/internal/config"
	"time-attendance-be/internal/pkg/clock"
	"time-attendance-be/internal/pkg/response"
)

type Service struct {
	cfg   *config.Config
	repo  *Repo
	clock clock.Clock
}

func NewService(cfg *config.Config, repo *Repo, clock clock.Clock) *Service {
	return &Service{cfg: cfg, repo: repo, clock: clock}
}

func (s *Service) GetMe(ctx context.Context, userID uint, dateStr string) (*DailyNote, error) {
	loc := s.cfg.TimeLocation()
	d, err := time.ParseInLocation("2006-01-02", dateStr, loc)
	if err != nil {
		return nil, response.Validation("Invalid date", nil)
	}
	return s.repo.GetByUserDate(ctx, userID, d)
}

func (s *Service) PutMe(ctx context.Context, userID uint, dateStr string, content string) (*DailyNote, error) {
	loc := s.cfg.TimeLocation()
	d, err := time.ParseInLocation("2006-01-02", dateStr, loc)
	if err != nil {
		return nil, response.Validation("Invalid date", nil)
	}

	note, err := s.repo.GetByUserDate(ctx, userID, d)
	if err != nil {
		return nil, err
	}

	note.UserID = userID
	note.WorkDate = d
	note.Content = content
	note.UpdatedAt = s.clock.Now().In(loc)
	if note.CreatedAt.IsZero() {
		note.CreatedAt = s.clock.Now().In(loc)
	}

	if err := s.repo.Save(ctx, note); err != nil {
		return nil, err
	}
	return note, nil
}

