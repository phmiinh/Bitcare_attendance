package workcalendar

import "time"

// WorkCalendar represents a working/non-working day and expected work units.
type WorkCalendar struct {
	WorkDate     time.Time `gorm:"type:date;primaryKey"`
	IsWorkingDay bool      `gorm:"not null"`
	WorkUnit     float64   `gorm:"type:decimal(2,1);not null;default:1.0"`
	Note         *string   `gorm:"type:varchar(255)"`
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

func (WorkCalendar) TableName() string {
	return "work_calendar"
}

