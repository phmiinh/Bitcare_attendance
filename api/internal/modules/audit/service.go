package audit

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

type Service struct {
	repo *Repo
}

func NewService(repo *Repo) *Service {
	return &Service{repo: repo}
}

func (s *Service) LogAction(ctx context.Context, log *AuditLog) error {
	return s.repo.Create(ctx, log)
}

func (s *Service) LogAdminAction(
	ctx context.Context,
	adminUserID uint,
	actionType string,
	entityType string,
	entityID string,
	before interface{},
	after interface{},
	reason string,
) error {
	var beforeJSON, afterJSON JSONB

	if before != nil {
		b, err := json.Marshal(before)
		if err != nil {
			return fmt.Errorf("marshal before: %w", err)
		}
		if err := json.Unmarshal(b, &beforeJSON); err != nil {
			return fmt.Errorf("unmarshal before: %w", err)
		}
	}

	if after != nil {
		a, err := json.Marshal(after)
		if err != nil {
			return fmt.Errorf("marshal after: %w", err)
		}
		if err := json.Unmarshal(a, &afterJSON); err != nil {
			return fmt.Errorf("unmarshal after: %w", err)
		}
	}

	log := &AuditLog{
		AdminUserID: adminUserID,
		ActionType:  actionType,
		EntityType:  entityType,
		EntityID:    entityID,
		BeforeJSON:  beforeJSON,
		AfterJSON:   afterJSON,
		Reason:      reason,
		CreatedAt:   time.Now(),
	}

	return s.repo.Create(ctx, log)
}

func (s *Service) ListLogs(ctx context.Context, filter AuditFilter) ([]AuditLog, int64, error) {
	return s.repo.List(ctx, filter)
}
