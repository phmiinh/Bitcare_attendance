package leave

import (
	"context"
	"fmt"
	"time"

	"time-attendance-be/internal/config"
	"time-attendance-be/internal/modules/attendance"
	"time-attendance-be/internal/modules/user"

	"go.uber.org/zap"
)

type AttendanceRepo interface {
	FindByUserDate(userID uint, workDate string) (*attendance.Session, error)
	GetDatesWithoutAttendance(ctx context.Context, userID uint, fromDate, toDate time.Time) ([]time.Time, error)
	GetSessionsWithDayUnitZero(ctx context.Context, fromDate, toDate time.Time) ([]attendance.Session, error)
	SumDayUnitByRange(ctx context.Context, userID uint, from, to string) (float64, error)
	GetYearMonthWithAttendance(ctx context.Context) ([]struct {
		Year  int
		Month int
	}, error)
}

type Service struct {
	cfg            *config.Config
	userRepo       *user.Repo
	repo           *Repo
	attendanceRepo AttendanceRepo
	workCalRepo    WorkCalendarRepo
	logger         *zap.Logger
}

func NewService(cfg *config.Config, userRepo *user.Repo, repo *Repo, logger *zap.Logger) *Service {
	return &Service{
		cfg:      cfg,
		userRepo: userRepo,
		repo:     repo,
		logger:   logger,
	}
}

func (s *Service) SetAttendanceRepo(attRepo AttendanceRepo) {
	s.attendanceRepo = attRepo
}

func (s *Service) SetWorkCalendarRepo(repo WorkCalendarRepo) {
	s.workCalRepo = repo
}

// ProcessMonthlyLeaveGrant processes monthly leave grant
// - Checks if the current month has already been granted leave
// - If not granted yet, automatically grants leave for all active users
// - Adds 1 day of leave for all active users
// - Prevents duplicate grants by checking leave_grants table
// Note: Birthday leave is no longer granted separately - it's calculated dynamically in ComputeMonthlySummary
func (s *Service) ProcessMonthlyLeaveGrant(ctx context.Context) error {
	now := time.Now().In(s.cfg.TimeLocation())
	currentYear := now.Year()
	currentMonth := int(now.Month())
	currentDay := now.Day()

	// Check if monthly grant has already been given for this month/year
	hasGrant, err := s.repo.HasMonthlyGrant(ctx, currentYear, currentMonth)
	if err != nil {
		s.logger.Error("failed to check monthly grant", zap.Error(err))
		return err
	}
	if hasGrant {
		s.logger.Info("monthly leave grant already processed for this month",
			zap.Int("year", currentYear),
			zap.Int("month", currentMonth),
			zap.Int("day", currentDay))
		return nil
	}

	// If we're past the 1st of the month and grant hasn't been processed, process it now
	// This handles cases where server was down on the 1st or restarted after the 1st
	if currentDay > 1 {
		s.logger.Info("processing late monthly leave grant - grant not found for current month",
			zap.Int("year", currentYear),
			zap.Int("month", currentMonth),
			zap.Int("day", currentDay))
	}

	s.logger.Info("processing monthly leave grant",
		zap.Int("year", currentYear),
		zap.Int("month", currentMonth),
		zap.Int("day", currentDay))

	// Get all active users
	users, err := s.userRepo.GetAllActiveUsers(ctx)
	if err != nil {
		s.logger.Error("failed to get active users", zap.Error(err))
		return err
	}

	if len(users) == 0 {
		s.logger.Info("no active users found")
		// Still record the grant to prevent retry
		if err := s.repo.CreateMonthlyGrant(ctx, currentYear, currentMonth); err != nil {
			s.logger.Error("failed to create monthly grant record", zap.Error(err))
		}
		return nil
	}

	// Get all user IDs
	var allUserIDs []uint
	for _, u := range users {
		allUserIDs = append(allUserIDs, u.ID)
	}

	// IMPORTANT: Create grant record FIRST to prevent duplicate grants
	// This uses ON CONFLICT to ensure idempotency - if grant already exists, does nothing
	if err := s.repo.CreateMonthlyGrant(ctx, currentYear, currentMonth); err != nil {
		s.logger.Error("failed to create monthly grant record", zap.Error(err))
		return err // Don't proceed if we can't record the grant
	}
	s.logger.Info("monthly grant record created", zap.Int("year", currentYear), zap.Int("month", currentMonth))

	// Double-check: if grant was created by another process, don't proceed
	hasGrant, err = s.repo.HasMonthlyGrant(ctx, currentYear, currentMonth)
	if err != nil {
		s.logger.Error("failed to re-check monthly grant after creation", zap.Error(err))
		return err
	}
	if !hasGrant {
		// This shouldn't happen, but if it does, something is wrong
		s.logger.Error("grant record not found after creation - possible race condition")
		return fmt.Errorf("grant record not found after creation")
	}

	// Now add 1 day for all active users (regular monthly leave)
	if err := s.userRepo.BatchIncrementPaidLeave(ctx, allUserIDs, 1.0); err != nil {
		s.logger.Error("failed to increment paid leave for all users", zap.Error(err))
		return err
	}
	s.logger.Info("added 1 day leave for all active users", zap.Int("count", len(allUserIDs)))

	// Note: Birthday leave is no longer granted separately.
	// It's calculated dynamically in ComputeMonthlySummary based on user.birthday.

	// Compute monthly summary for all users for current month (lazy initialization)
	// This ensures summary exists even if user hasn't queried it yet
	if s.attendanceRepo != nil && s.workCalRepo != nil {
		s.logger.Info("computing monthly summary for all users", zap.Int("year", currentYear), zap.Int("month", currentMonth))
		for _, userID := range allUserIDs {
			if _, err := s.ComputeMonthlySummary(ctx, userID, currentYear, currentMonth); err != nil {
				s.logger.Error("failed to compute monthly summary after grant",
					zap.Uint("userID", userID),
					zap.Int("year", currentYear),
					zap.Int("month", currentMonth),
					zap.Error(err))
				// Continue with other users
			}
		}
	}

	return nil
}

// ProcessLeaveGrantForMonth processes leave grant for a specific month/year (for manual/admin use)
// This bypasses the day-of-month check and allows processing any month
func (s *Service) ProcessLeaveGrantForMonth(ctx context.Context, year, month int) error {
	// Check if monthly grant has already been given for this month/year
	hasGrant, err := s.repo.HasMonthlyGrant(ctx, year, month)
	if err != nil {
		s.logger.Error("failed to check monthly grant", zap.Error(err))
		return err
	}
	if hasGrant {
		s.logger.Info("monthly leave grant already processed for this month",
			zap.Int("year", year),
			zap.Int("month", month))
		return nil
	}

	s.logger.Info("processing monthly leave grant (manual)",
		zap.Int("year", year),
		zap.Int("month", month))

	// Get all active users
	users, err := s.userRepo.GetAllActiveUsers(ctx)
	if err != nil {
		s.logger.Error("failed to get active users", zap.Error(err))
		return err
	}

	if len(users) == 0 {
		s.logger.Info("no active users found")
		// Still record the grant to prevent retry
		if err := s.repo.CreateMonthlyGrant(ctx, year, month); err != nil {
			s.logger.Error("failed to create monthly grant record", zap.Error(err))
		}
		return nil
	}

	// Get all user IDs
	var allUserIDs []uint
	for _, u := range users {
		allUserIDs = append(allUserIDs, u.ID)
	}

	// IMPORTANT: Create grant record FIRST to prevent duplicate grants
	// This uses ON CONFLICT to ensure idempotency - if grant already exists, does nothing
	if err := s.repo.CreateMonthlyGrant(ctx, year, month); err != nil {
		s.logger.Error("failed to create monthly grant record", zap.Error(err))
		return err // Don't proceed if we can't record the grant
	}
	s.logger.Info("monthly grant record created", zap.Int("year", year), zap.Int("month", month))

	// Double-check: if grant was created by another process, don't proceed
	hasGrant, err = s.repo.HasMonthlyGrant(ctx, year, month)
	if err != nil {
		s.logger.Error("failed to re-check monthly grant after creation", zap.Error(err))
		return err
	}
	if !hasGrant {
		// This shouldn't happen, but if it does, something is wrong
		s.logger.Error("grant record not found after creation - possible race condition")
		return fmt.Errorf("grant record not found after creation")
	}

	// Now add 1 day for all active users (regular monthly leave)
	if err := s.userRepo.BatchIncrementPaidLeave(ctx, allUserIDs, 1.0); err != nil {
		s.logger.Error("failed to increment paid leave for all users", zap.Error(err))
		return err
	}
	s.logger.Info("added 1 day leave for all active users", zap.Int("count", len(allUserIDs)))

	// Note: Birthday leave is no longer granted separately.
	// It's calculated dynamically in ComputeMonthlySummary based on user.birthday.

	return nil
}

// ProcessPreviousMonthLeaveDeduction processes leave deduction from previous month on the 1st of each month
// - Computes monthly summary for all users for previous month
// - Deducts paid_used_units from users.paid_leave
// - This ensures paid leave is deducted based on actual usage
func (s *Service) ProcessPreviousMonthLeaveDeduction(ctx context.Context) error {
	now := time.Now().In(s.cfg.TimeLocation())
	currentDay := now.Day()

	// Only process on the 1st of the month
	if currentDay != 1 {
		s.logger.Debug("previous month leave deduction skipped - not the 1st of month",
			zap.Int("day", currentDay))
		return nil
	}

	// Calculate previous month
	prevMonth := now.AddDate(0, -1, 0)
	prevYear := prevMonth.Year()
	prevMonthNum := int(prevMonth.Month())

	s.logger.Info("processing previous month leave deduction",
		zap.Int("year", prevYear),
		zap.Int("month", prevMonthNum))

	// Get all active users
	users, err := s.userRepo.GetAllActiveUsers(ctx)
	if err != nil {
		s.logger.Error("failed to get active users for leave deduction", zap.Error(err))
		return err
	}

	if len(users) == 0 {
		s.logger.Info("no active users found for leave deduction")
		return nil
	}

	// Compute summary and deduct paid leave for each user
	var usersToDeduct []struct {
		userID    uint
		deductAmt float64
	}

	for _, user := range users {
		summary, err := s.ComputeMonthlySummary(ctx, user.ID, prevYear, prevMonthNum)
		if err != nil {
			s.logger.Error("failed to compute monthly summary for leave deduction",
				zap.Uint("userID", user.ID),
				zap.Int("year", prevYear),
				zap.Int("month", prevMonthNum),
				zap.Error(err))
			continue
		}

		if summary != nil && summary.PaidUsedUnits > 0 {
			usersToDeduct = append(usersToDeduct, struct {
				userID    uint
				deductAmt float64
			}{
				userID:    user.ID,
				deductAmt: summary.PaidUsedUnits,
			})
		}
	}

	if len(usersToDeduct) == 0 {
		s.logger.Info("no paid leave to deduct for previous month",
			zap.Int("year", prevYear),
			zap.Int("month", prevMonthNum))
		return nil
	}

	// Deduct paid leave for each user
	// Note: Each user may have different amounts, so we deduct individually
	// Group by amount to use batch operations when possible for efficiency
	deductMap := make(map[float64][]uint)
	for _, item := range usersToDeduct {
		deductMap[item.deductAmt] = append(deductMap[item.deductAmt], item.userID)
	}

	for amount, userIDs := range deductMap {
		if err := s.userRepo.BatchDecrementPaidLeave(ctx, userIDs, amount); err != nil {
			s.logger.Error("failed to deduct paid leave",
				zap.Float64("amount", amount),
				zap.Int("userCount", len(userIDs)),
				zap.Error(err))
			continue
		}
		s.logger.Info("deducted paid leave from previous month",
			zap.Float64("amount", amount),
			zap.Int("userCount", len(userIDs)),
			zap.Int("year", prevYear),
			zap.Int("month", prevMonthNum))
	}

	s.logger.Info("processed previous month leave deduction",
		zap.Int("year", prevYear),
		zap.Int("month", prevMonthNum),
		zap.Int("usersProcessed", len(usersToDeduct)))

	return nil
}

// Leave Usage Service Methods

// CreateLeaveUsage creates a leave usage record and deducts from user's paid_leave
// - If user has enough paid leave: deducts normally
// - If user doesn't have enough: deducts all available leave, marks remainder as unpaid
// - In birthday month: prioritizes deducting birthday leave first
// - Source and sourceRef are used for idempotency and auditing
func (s *Service) CreateLeaveUsage(ctx context.Context, userID uint, usageDate time.Time, daysUsed float64, leaveType string, reason *string, source string, sourceRef *string) error {
	// Deprecated in new design (no per-day leave_usage)
	s.logger.Debug("CreateLeaveUsage is disabled in summary-only design", zap.Uint("userID", userID))
	return nil
}

// CreateLeaveUsageForDayUnitZero creates leave usage when dayUnit is 0 (not counted)
// This is called automatically when user checks out and dayUnit = 0
func (s *Service) CreateLeaveUsageForDayUnitZero(ctx context.Context, userID uint, usageDate time.Time, sourceRef string) error {
	// Disabled in summary-only design
	return nil
}

// GetLeaveUsageByUser returns leave usage records for a user
func (s *Service) GetLeaveUsageByUser(ctx context.Context, userID uint, fromDate, toDate time.Time) ([]LeaveUsage, error) {
	return []LeaveUsage{}, nil
}

// GetLeaveUsageByUserAndMonth returns leave usage records for a user in a specific month
func (s *Service) GetLeaveUsageByUserAndMonth(ctx context.Context, userID uint, year, month int) ([]LeaveUsage, error) {
	return []LeaveUsage{}, nil
}

// GetLeaveUsageInfoByUserAndMonth implements attendance.LeaveRepo interface
// Returns leave usage info for attendance service (to avoid circular dependency)
func (s *Service) GetLeaveUsageInfoByUserAndMonth(ctx context.Context, userID uint, year, month int) ([]attendance.LeaveUsageInfo, error) {
	return []attendance.LeaveUsageInfo{}, nil
}

// GetTotalDaysUsedInMonth returns total days of leave used by a user in a specific month
func (s *Service) GetTotalDaysUsedInMonth(ctx context.Context, userID uint, year, month int) (float64, error) {
	return 0, nil
}

// GetUnpaidDaysInMonth returns total unpaid leave days for a user in a specific month
func (s *Service) GetUnpaidDaysInMonth(ctx context.Context, userID uint, year, month int) (float64, error) {
	return 0, nil
}

// ProcessAutoLeaveDetection is disabled in summary-only design.
// Kept only to satisfy existing scheduler calls; does nothing.
func (s *Service) ProcessAutoLeaveDetection(ctx context.Context, checkFromDate ...time.Time) error {
	return nil
}

// ProcessDayUnitZeroBackfill is disabled in summary-only design.
// Kept only for backward compatibility with existing scheduler calls.
func (s *Service) ProcessDayUnitZeroBackfill(ctx context.Context, fromDate, toDate time.Time) error {
	return nil
}

// ProcessSummaryBackfill computes monthly summary for all users for months that have attendance but no summary
// This ensures summary exists for historical data (e.g., attendance from Dec 2025 but calendar/summary not created)
func (s *Service) ProcessSummaryBackfill(ctx context.Context) error {
	if s.attendanceRepo == nil || s.workCalRepo == nil {
		s.logger.Debug("summary backfill skipped - attendance or work calendar repo not set")
		return nil
	}

	// Get all year-month combinations that have attendance
	attendanceMonths, err := s.attendanceRepo.GetYearMonthWithAttendance(ctx)
	if err != nil {
		s.logger.Error("failed to get year-month with attendance", zap.Error(err))
		return err
	}

	if len(attendanceMonths) == 0 {
		s.logger.Debug("no attendance data found for summary backfill")
		return nil
	}

	// Get all year-month combinations that already have summaries
	summaryMonths, err := s.repo.GetYearMonthWithSummary(ctx)
	if err != nil {
		s.logger.Error("failed to get year-month with summary", zap.Error(err))
		return err
	}

	// Create a map of existing summaries for quick lookup
	summaryMap := make(map[string]bool)
	for _, sm := range summaryMonths {
		key := fmt.Sprintf("%d-%02d", sm.Year, sm.Month)
		summaryMap[key] = true
	}

	// Find months that have attendance but no summary
	var monthsToProcess []struct {
		Year  int
		Month int
	}
	for _, am := range attendanceMonths {
		key := fmt.Sprintf("%d-%02d", am.Year, am.Month)
		if !summaryMap[key] {
			monthsToProcess = append(monthsToProcess, am)
		}
	}

	if len(monthsToProcess) == 0 {
		s.logger.Debug("all months with attendance already have summaries")
		return nil
	}

	s.logger.Info("found months with attendance but no summary",
		zap.Int("count", len(monthsToProcess)))

	// Get all active users
	users, err := s.userRepo.GetAllActiveUsers(ctx)
	if err != nil {
		s.logger.Error("failed to get active users for summary backfill", zap.Error(err))
		return err
	}

	// Process each month
	for _, monthInfo := range monthsToProcess {
		year := monthInfo.Year
		month := monthInfo.Month

		// Ensure calendar exists for this year
		if err := s.workCalRepo.EnsureYear(ctx, year); err != nil {
			s.logger.Error("failed to ensure work calendar for year",
				zap.Int("year", year),
				zap.Error(err))
			continue
		}

		// Compute summary for all users for this month
		for _, user := range users {
			if _, err := s.ComputeMonthlySummary(ctx, user.ID, year, month); err != nil {
				s.logger.Error("failed to compute monthly summary in backfill",
					zap.Uint("userID", user.ID),
					zap.Int("year", year),
					zap.Int("month", month),
					zap.Error(err))
				// Continue with other users
			}
		}

		s.logger.Info("backfilled summary for month",
			zap.Int("year", year),
			zap.Int("month", month),
			zap.Int("userCount", len(users)))
	}

	return nil
}

// StartScheduler starts the scheduled job that runs daily to check if leave grant is needed
// - On startup: checks if current month has been granted, if not, grants it
// - Daily: checks if it's the 1st of the month and grant hasn't been processed yet
// - Also processes birthday leave deduction on the 1st of each month
// ListMonthlySummaries returns summaries with optional filters
func (s *Service) ListMonthlySummaries(ctx context.Context, year, month int, userID *uint, departmentID *uint) ([]MonthlySummary, error) {
	return s.repo.ListMonthlySummaries(ctx, year, month, userID, departmentID)
}

// ListGrants returns all leave grants
func (s *Service) ListGrants(ctx context.Context) ([]LeaveGrant, error) {
	return s.repo.ListGrants(ctx)
}

// AdjustUserPaidLeave updates user's paid_leave balance
func (s *Service) AdjustUserPaidLeave(ctx context.Context, userID uint, paidLeave float64) error {
	user, err := s.userRepo.GetByID(ctx, userID)
	if err != nil {
		return fmt.Errorf("get user: %w", err)
	}
	
	user.PaidLeave = paidLeave
	if err := s.userRepo.Update(ctx, user); err != nil {
		return fmt.Errorf("update user: %w", err)
	}
	
	return nil
}

// GetUserIDsWithSummaryInMonth returns distinct user IDs that have summaries for a specific year/month
func (s *Service) GetUserIDsWithSummaryInMonth(ctx context.Context, year, month int) ([]uint, error) {
	return s.repo.GetUserIDsWithSummaryInMonth(ctx, year, month)
}

func (s *Service) StartScheduler(ctx context.Context) {
	ticker := time.NewTicker(24 * time.Hour) // Check once per day
	defer ticker.Stop()

	// Run immediately on startup to check if current month needs grant
	s.logger.Info("leave scheduler started - checking current month grant status")
	s.ProcessMonthlyLeaveGrant(ctx)
	s.ProcessPreviousMonthLeaveDeduction(ctx)

	// Backfill summaries for months with attendance but no summary
	s.ProcessSummaryBackfill(ctx)

	// Ensure work calendar for current year (and pre-create if missing)
	if s.workCalRepo != nil {
		now := time.Now().In(s.cfg.TimeLocation())
		year := now.Year()
		if err := s.workCalRepo.EnsureYear(ctx, year); err != nil {
			s.logger.Error("failed to ensure work calendar for current year", zap.Int("year", year), zap.Error(err))
		} else {
			s.logger.Info("work calendar ensured", zap.Int("year", year))
		}
	}

	// Then check daily
	for {
		select {
		case <-ctx.Done():
			s.logger.Info("leave scheduler stopped")
			return
		case <-ticker.C:
			// Each day, ensure work calendar for current year (use server time)
			if s.workCalRepo != nil {
				today := time.Now().In(s.cfg.TimeLocation())
				year := today.Year()
				if err := s.workCalRepo.EnsureYear(ctx, year); err != nil {
					s.logger.Error("failed to ensure work calendar for current year", zap.Int("year", year), zap.Error(err))
				}
			}

			// Check daily - will process if it's the 1st and grant hasn't been done
			// or if grant is missing for current month
			s.ProcessMonthlyLeaveGrant(ctx)
			s.ProcessPreviousMonthLeaveDeduction(ctx)

			// Backfill summaries weekly (only on Monday to avoid too frequent checks)
			now := time.Now().In(s.cfg.TimeLocation())
			if now.Weekday() == time.Monday {
				s.ProcessSummaryBackfill(ctx)
			}
		}
	}
}
