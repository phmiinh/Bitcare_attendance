package leave

import (
	"context"
	"fmt"
	"time"
)

// ComputeMonthlySummary computes projected summary for a user/month (realtime) and upserts to DB.
func (s *Service) ComputeMonthlySummary(ctx context.Context, userID uint, year, month int) (*MonthlySummary, error) {
	if s.workCalRepo == nil || s.attendanceRepo == nil {
		return nil, fmt.Errorf("work calendar or attendance repo not set")
	}

	// Ensure calendar exists
	if err := s.workCalRepo.EnsureYear(ctx, year); err != nil {
		return nil, fmt.Errorf("ensure calendar year: %w", err)
	}

	startDate := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, s.cfg.TimeLocation())
	endDate := startDate.AddDate(0, 1, -1)

	// For realtime calculation: only count expected units up to today if we're in the current month
	now := time.Now().In(s.cfg.TimeLocation())
	currentYear := now.Year()
	currentMonth := int(now.Month())
	currentDay := now.Day()

	// If we're calculating for the current month, only count up to today
	// Otherwise, count the whole month
	calcEndDate := endDate
	if year == currentYear && month == currentMonth {
		// We're in the current month - only count up to today
		calcEndDate = time.Date(currentYear, time.Month(currentMonth), currentDay, 23, 59, 59, 0, s.cfg.TimeLocation())
		if calcEndDate.After(endDate) {
			calcEndDate = endDate
		}
	}

	// Fetch calendar range (only up to today if current month)
	calDays, err := s.workCalRepo.ListRange(ctx, startDate, calcEndDate)
	if err != nil {
		return nil, fmt.Errorf("list calendar: %w", err)
	}

	expected := 0.0
	for _, d := range calDays {
		if d.IsWorkingDay && d.WorkUnit > 0 {
			expected += d.WorkUnit
		}
	}

	// Worked units (only CLOSED sessions) - also only up to today if current month
	workStr := startDate.Format("2006-01-02")
	workEndStr := calcEndDate.Format("2006-01-02")
	worked, err := s.attendanceRepo.SumDayUnitByRange(ctx, userID, workStr, workEndStr)
	if err != nil {
		return nil, fmt.Errorf("sum attendance: %w", err)
	}

	missing := expected - worked
	if missing < 0 {
		missing = 0
	}

	// Paid available (snapshot) from user
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}
	paidAvailable := user.PaidLeave
	if paidAvailable < 0 {
		paidAvailable = 0
	}

	// Check if this is birthday month
	isBirthdayMonth := false
	if user.Birthday != nil {
		birthdayMonth := int(user.Birthday.Month())
		isBirthdayMonth = (birthdayMonth == month)
	}

	// Calculate paid used: prioritize birthday leave if in birthday month
	// Logic: missing - birthday_leave_used - paid_used = unpaid
	// Birthday leave is FREE (doesn't deduct from paid_leave)
	// So: paid_used should NOT include birthday leave
	paidUsed := 0.0
	unpaid := missing

	if missing > 0 {
		// If birthday month: user has 1 additional day of birthday leave (FREE)
		// This birthday leave can only be used in birthday month
		// First, use birthday leave if available
		remainingMissing := missing
		if isBirthdayMonth && remainingMissing > 0 {
			// Use birthday leave first (up to 1 day)
			birthdayLeaveUsed := 0.0
			if remainingMissing >= 1.0 {
				birthdayLeaveUsed = 1.0
			} else {
				birthdayLeaveUsed = remainingMissing
			}
			remainingMissing = remainingMissing - birthdayLeaveUsed
		}

		// Then, use regular paid leave for remaining missing days
		if remainingMissing > 0 {
			if remainingMissing <= paidAvailable {
				// Enough paid leave
				paidUsed = remainingMissing
				unpaid = 0.0
			} else {
				// Not enough paid leave
				paidUsed = paidAvailable
				unpaid = remainingMissing - paidUsed
			}
		} else {
			// All missing days covered by birthday leave
			paidUsed = 0.0
			unpaid = 0.0
		}
	}

	summary := &MonthlySummary{
		UserID:        userID,
		Year:          year,
		Month:         month,
		ExpectedUnits: expected,
		WorkedUnits:   worked,
		MissingUnits:  missing,
		PaidUsedUnits: paidUsed,
		UnpaidUnits:   unpaid,
		IsBirthday:    isBirthdayMonth,
		UpdatedAt:     time.Now(),
	}

	if err := s.repo.UpsertMonthlySummary(ctx, summary); err != nil {
		return nil, fmt.Errorf("upsert summary: %w", err)
	}

	return summary, nil
}
