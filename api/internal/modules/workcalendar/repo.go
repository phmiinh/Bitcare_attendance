package workcalendar

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repo struct {
	db *gorm.DB
}

func NewRepo(db *gorm.DB) *Repo {
	return &Repo{db: db}
}

// ListRange returns calendar rows in [from, to]
func (r *Repo) ListRange(ctx context.Context, fromDate, toDate time.Time) ([]WorkCalendar, error) {
	var days []WorkCalendar
	err := r.db.WithContext(ctx).
		Where("work_date >= ? AND work_date <= ?", fromDate.Format("2006-01-02"), toDate.Format("2006-01-02")).
		Order("work_date asc").
		Find(&days).Error
	return days, err
}

// Upsert inserts or updates a calendar day.
func (r *Repo) Upsert(ctx context.Context, day *WorkCalendar) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "work_date"}},
			DoUpdates: clause.AssignmentColumns([]string{"is_working_day", "work_unit", "note", "updated_at"}),
		}).Create(day).Error
}

// IsWorkingDay returns (isWorking, workUnit, exists).
func (r *Repo) IsWorkingDay(ctx context.Context, date time.Time) (bool, float64, bool, error) {
	var cal WorkCalendar
	err := r.db.WithContext(ctx).
		Where("work_date = ?", date.Format("2006-01-02")).
		First(&cal).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return false, 0, false, nil
		}
		return false, 0, false, err
	}
	return cal.IsWorkingDay, cal.WorkUnit, true, nil
}

// GetByDate returns the WorkCalendar record for a specific date, or nil if not found.
func (r *Repo) GetByDate(ctx context.Context, date time.Time) (*WorkCalendar, error) {
	var cal WorkCalendar
	err := r.db.WithContext(ctx).
		Where("work_date = ?", date.Format("2006-01-02")).
		First(&cal).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &cal, nil
}

// EnsureYear generates calendar rows for a year if they don't exist.
// Default rule: Mon-Fri working (1.0), Sat/Sun off (0.0).
func (r *Repo) EnsureYear(ctx context.Context, year int) error {
	start := time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(1, 0, 0)

	// Quick check: if year already has rows, skip generation.
	var count int64
	if err := r.db.WithContext(ctx).
		Model(&WorkCalendar{}).
		Where("work_date >= ? AND work_date < ?", start, end).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	batch := make([]WorkCalendar, 0, 370)
	cur := start
	for cur.Before(end) {
		weekday := cur.Weekday()
		isWorking := weekday >= time.Monday && weekday <= time.Friday
		workUnit := 0.0
		if isWorking {
			workUnit = 1.0
		}
		day := WorkCalendar{
			WorkDate:     cur,
			IsWorkingDay: isWorking,
			WorkUnit:     workUnit,
		}
		batch = append(batch, day)
		cur = cur.AddDate(0, 0, 1)
	}
	return r.db.WithContext(ctx).Create(&batch).Error
}

