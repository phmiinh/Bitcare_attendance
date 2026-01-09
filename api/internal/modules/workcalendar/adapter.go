package workcalendar

import (
	"context"
	"time"

	"time-attendance-be/internal/modules/leave"
)

// Adapter implements the leave.WorkCalendarRepo interface
type Adapter struct {
	repo *Repo
}

// NewAdapter creates a new work calendar adapter
func NewAdapter(repo *Repo) *Adapter {
	return &Adapter{repo: repo}
}

// EnsureYear implements leave.WorkCalendarRepo
func (a *Adapter) EnsureYear(ctx context.Context, year int) error {
	return a.repo.EnsureYear(ctx, year)
}

// ListRange implements leave.WorkCalendarRepo
func (a *Adapter) ListRange(ctx context.Context, fromDate, toDate time.Time) ([]leave.WorkCalendarDay, error) {
	days, err := a.repo.ListRange(ctx, fromDate, toDate)
	if err != nil {
		return nil, err
	}

	// Convert WorkCalendar to leave.WorkCalendarDay
	result := make([]leave.WorkCalendarDay, len(days))
	for i, day := range days {
		result[i] = leave.WorkCalendarDay{
			WorkDate:     day.WorkDate,
			IsWorkingDay: day.IsWorkingDay,
			WorkUnit:     day.WorkUnit,
		}
	}

	return result, nil
}

// IsWorkingDay implements leave.WorkCalendarRepo
func (a *Adapter) IsWorkingDay(ctx context.Context, date time.Time) (bool, float64, bool, error) {
	// Get the day from the calendar
	days, err := a.repo.ListRange(ctx, date, date)
	if err != nil {
		return false, 0, false, err
	}

	if len(days) == 0 {
		// If not found, it's not a working day
		return false, 0, false, nil
	}

	day := days[0]
	return day.IsWorkingDay, day.WorkUnit, true, nil
}