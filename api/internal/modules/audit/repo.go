package audit

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Repo struct {
	db *gorm.DB
}

func NewRepo(db *gorm.DB) *Repo {
	return &Repo{db: db}
}

func (r *Repo) Create(ctx context.Context, log *AuditLog) error {
	return r.db.WithContext(ctx).Create(log).Error
}

func (r *Repo) List(ctx context.Context, filter AuditFilter) ([]AuditLog, int64, error) {
	query := r.db.WithContext(ctx).Model(&AuditLog{})

	if filter.AdminUserID != nil {
		query = query.Where("admin_user_id = ?", *filter.AdminUserID)
	}
	if filter.EntityType != nil {
		query = query.Where("entity_type = ?", *filter.EntityType)
	}
	if filter.EntityID != nil {
		query = query.Where("entity_id = ?", *filter.EntityID)
	}
	if filter.ActionType != nil {
		query = query.Where("action_type = ?", *filter.ActionType)
	}
	if filter.From != nil {
		query = query.Where("created_at >= ?", *filter.From)
	}
	if filter.To != nil {
		query = query.Where("created_at <= ?", *filter.To)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if filter.Limit > 0 {
		query = query.Limit(filter.Limit)
	}
	if filter.Offset > 0 {
		query = query.Offset(filter.Offset)
	}

	var logs []AuditLog
	err := query.Order("created_at DESC").Find(&logs).Error
	return logs, total, err
}

type AuditFilter struct {
	AdminUserID *uint
	EntityType  *string
	EntityID    *string
	ActionType  *string
	From        *time.Time
	To          *time.Time
	Limit       int
	Offset      int
}
