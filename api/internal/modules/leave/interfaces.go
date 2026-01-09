package leave

import (
	"context"
	"time"
)

// WorkCalendarDay defines the structure for a calendar day that the leave module needs.
// This avoids a direct dependency on the workcalendar module.
type WorkCalendarDay struct {
	WorkDate     time.Time
	IsWorkingDay bool
	WorkUnit     float64
}

// WorkCalendarRepo defines the interface for accessing work calendar data.
// This is implemented by an adapter in the workcalendar module.
type WorkCalendarRepo interface {
	EnsureYear(ctx context.Context, year int) error
	ListRange(ctx context.Context, fromDate, toDate time.Time) ([]WorkCalendarDay, error)
}
