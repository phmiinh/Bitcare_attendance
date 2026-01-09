package notes

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Repo struct {
	db *gorm.DB
}

func NewRepo(db *gorm.DB) *Repo { return &Repo{db: db} }

func (r *Repo) GetByUserDate(ctx context.Context, userID uint, workDate time.Time) (*DailyNote, error) {
	var note DailyNote
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND work_date = ?", userID, workDate.Format("2006-01-02")).
		First(&note).Error

	if err == gorm.ErrRecordNotFound {
		return &DailyNote{
			UserID:   userID,
			WorkDate: workDate,
			Content:  "",
		}, nil
	}

	return &note, err
}

func (r *Repo) Save(ctx context.Context, note *DailyNote) error {
	return r.db.WithContext(ctx).Save(note).Error
}

