package leave

import (
	"context"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repo struct {
	db *gorm.DB
}

func NewRepo(db *gorm.DB) *Repo {
	return &Repo{db: db}
}

// HasMonthlyGrant checks if monthly grant has been given for a specific year/month
// Only checks non-deleted grants (GORM automatically filters soft-deleted records)
func (r *Repo) HasMonthlyGrant(ctx context.Context, year, month int) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&LeaveGrant{}).
		Where("grant_year = ? AND grant_month = ? AND grant_type = ? AND deleted_at IS NULL", year, month, GrantTypeMonthly).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// CreateMonthlyGrant creates a record for monthly grant (for all active users)
// Uses ON CONFLICT to ensure idempotency - if grant already exists, does nothing
func (r *Repo) CreateMonthlyGrant(ctx context.Context, year, month int) error {
	grant := &LeaveGrant{
		GrantYear:  year,
		GrantMonth: month,
		GrantType:  GrantTypeMonthly,
	}
	// Use ON CONFLICT to make it idempotent - if unique key exists, do nothing
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "grant_year"}, {Name: "grant_month"}, {Name: "grant_type"}},
			DoNothing: true,
		}).Create(grant).Error
}

// Note: Birthday-related methods have been removed as birthday leave is now calculated dynamically
// in ComputeMonthlySummary based on user.birthday field, not granted separately.

// Monthly summary methods

// UpsertMonthlySummary upserts monthly summary
func (r *Repo) UpsertMonthlySummary(ctx context.Context, s *MonthlySummary) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "user_id"}, {Name: "year"}, {Name: "month"}},
			DoUpdates: clause.AssignmentColumns([]string{"expected_units", "worked_units", "missing_units", "paid_used_units", "unpaid_units", "is_birthday", "updated_at"}),
		}).Create(s).Error
}

// GetMonthlySummary returns summary if exists
func (r *Repo) GetMonthlySummary(ctx context.Context, userID uint, year, month int) (*MonthlySummary, error) {
	var s MonthlySummary
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND year = ? AND month = ?", userID, year, month).
		First(&s).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

// GetYearMonthWithSummary returns distinct year-month combinations that have summaries
func (r *Repo) GetYearMonthWithSummary(ctx context.Context) ([]struct {
	Year  int
	Month int
}, error) {
	type YearMonth struct {
		Year  int
		Month int
	}
	var results []YearMonth
	err := r.db.WithContext(ctx).
		Model(&MonthlySummary{}).
		Select("year, month").
		Group("year, month").
		Order("year DESC, month DESC").
		Scan(&results).Error
	if err != nil {
		return nil, err
	}

	// Convert to expected format
	var yearMonths []struct {
		Year  int
		Month int
	}
	for _, r := range results {
		yearMonths = append(yearMonths, struct {
			Year  int
			Month int
		}{Year: r.Year, Month: r.Month})
	}
	return yearMonths, nil
}

// ListMonthlySummaries returns summaries with optional filters
func (r *Repo) ListMonthlySummaries(ctx context.Context, year, month int, userID *uint, departmentID *uint) ([]MonthlySummary, error) {
	query := r.db.WithContext(ctx).
		Table("leave_monthly_summary").
		Where("year = ? AND month = ?", year, month)
	
	if userID != nil {
		query = query.Where("user_id = ?", *userID)
	}
	
	if departmentID != nil {
		query = query.Joins("INNER JOIN users u ON leave_monthly_summary.user_id = u.id").
			Where("u.department_id = ?", *departmentID)
	}
	
	var summaries []MonthlySummary
	err := query.Find(&summaries).Error
	return summaries, err
}

// ListGrants returns all leave grants
func (r *Repo) ListGrants(ctx context.Context) ([]LeaveGrant, error) {
	var grants []LeaveGrant
	err := r.db.WithContext(ctx).
		Model(&LeaveGrant{}).
		Where("deleted_at IS NULL").
		Order("grant_year DESC, grant_month DESC").
		Find(&grants).Error
	return grants, err
}

// GetUserIDsWithSummaryInMonth returns distinct user IDs that have summaries for a specific year/month
func (r *Repo) GetUserIDsWithSummaryInMonth(ctx context.Context, year, month int) ([]uint, error) {
	var userIDs []uint
	err := r.db.WithContext(ctx).
		Model(&MonthlySummary{}).
		Where("year = ? AND month = ?", year, month).
		Pluck("user_id", &userIDs).Error
	return userIDs, err
}
