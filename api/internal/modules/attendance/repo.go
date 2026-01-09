package attendance

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Repo struct {
	db *gorm.DB
}

func NewRepo(db *gorm.DB) *Repo { return &Repo{db: db} }

func (r *Repo) Create(session *Session) error {
	return r.db.Create(session).Error
}

func (r *Repo) FindByUserDate(userID uint, workDate string) (*Session, error) {
	var s Session
	// Use DATE() function to compare only date part, ignoring time/timezone
	if err := r.db.Where("user_id = ? AND DATE(work_date) = ?", userID, workDate).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repo) ListByUserDateRange(userID uint, from, to string) ([]Session, error) {
	var sessions []Session
	if err := r.db.Where("user_id = ? AND DATE(work_date) >= ? AND DATE(work_date) <= ?", userID, from, to).
		Order("work_date DESC").Find(&sessions).Error; err != nil {
		return nil, err
	}
	return sessions, nil
}

// SumDayUnitByRange sums day_unit for CLOSED sessions on working days in [from, to]
func (r *Repo) SumDayUnitByRange(ctx context.Context, userID uint, from, to string) (float64, error) {
	var total float64
	err := r.db.WithContext(ctx).
		Model(&Session{}).
		Joins("INNER JOIN work_calendar wc ON DATE(attendance_sessions.work_date) = wc.work_date").
		Where("attendance_sessions.user_id = ? AND attendance_sessions.status = 'CLOSED' AND DATE(attendance_sessions.work_date) >= ? AND DATE(attendance_sessions.work_date) <= ?", userID, from, to).
		Where("wc.is_working_day = ?", true).
		Select("COALESCE(SUM(attendance_sessions.day_unit), 0)").
		Scan(&total).Error
	return total, err
}

func (r *Repo) FindLatestOpen(userID uint) (*Session, error) {
	var s Session
	if err := r.db.Where("user_id = ? AND status = 'OPEN'", userID).
		Order("work_date desc").First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repo) Save(s *Session) error { return r.db.Save(s).Error }

// GetSessionsWithDayUnitZero returns all closed sessions with day_unit = 0
// Used for backfilling leave_usage records
func (r *Repo) GetSessionsWithDayUnitZero(ctx context.Context, fromDate, toDate time.Time) ([]Session, error) {
	var sessions []Session
	err := r.db.WithContext(ctx).
		Where("day_unit = 0 AND status = 'CLOSED' AND work_date >= ? AND work_date <= ?",
			fromDate.Format("2006-01-02"), toDate.Format("2006-01-02")).
		Find(&sessions).Error
	return sessions, err
}

// GetDatesWithoutAttendance returns dates in a range that don't have attendance sessions for a user
// Excludes weekends (Saturday=6, Sunday=0)
func (r *Repo) GetDatesWithoutAttendance(ctx context.Context, userID uint, fromDate, toDate time.Time) ([]time.Time, error) {
	var sessions []Session
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND DATE(work_date) >= ? AND DATE(work_date) <= ?", userID, fromDate.Format("2006-01-02"), toDate.Format("2006-01-02")).
		Select("DATE(work_date) as work_date").
		Find(&sessions).Error
	if err != nil {
		return nil, err
	}

	// Create a map of dates that have attendance
	hasAttendance := make(map[string]bool)
	for _, s := range sessions {
		dateStr := s.WorkDate.Format("2006-01-02")
		hasAttendance[dateStr] = true
	}

	// Find all dates in range that don't have attendance and are not weekends
	var missingDates []time.Time
	current := fromDate
	for !current.After(toDate) {
		// Skip weekends (Saturday=6, Sunday=0)
		weekday := current.Weekday()
		if weekday != time.Saturday && weekday != time.Sunday {
			dateStr := current.Format("2006-01-02")
			if !hasAttendance[dateStr] {
				missingDates = append(missingDates, current)
			}
		}
		current = current.AddDate(0, 0, 1)
	}

	return missingDates, nil
}

// GetYearMonthWithAttendance returns distinct year-month combinations that have attendance sessions
// Returns slice of structs with Year and Month fields
func (r *Repo) GetYearMonthWithAttendance(ctx context.Context) ([]struct {
	Year  int
	Month int
}, error) {
	type YearMonth struct {
		Year  int
		Month int
	}
	var results []YearMonth
	err := r.db.WithContext(ctx).
		Model(&Session{}).
		Select("YEAR(work_date) as year, MONTH(work_date) as month").
		Group("YEAR(work_date), MONTH(work_date)").
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

// Admin repo methods
type AdminListFilter struct {
	From         string
	To           string
	UserID       *uint
	DepartmentID *uint
	Status       *string
}

type AdminSessionRow struct {
	Session
	UserName       string
	DepartmentName *string
}

func (r *Repo) ListAdmin(ctx context.Context, filter AdminListFilter) ([]AdminSessionRow, error) {
	var rows []AdminSessionRow
	
	query := r.db.WithContext(ctx).
		Table("attendance_sessions AS s").
		Select("s.*, u.name as user_name, d.name as department_name").
		Joins("INNER JOIN users u ON s.user_id = u.id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id")
	
	if filter.From != "" {
		query = query.Where("DATE(s.work_date) >= ?", filter.From)
	}
	if filter.To != "" {
		query = query.Where("DATE(s.work_date) <= ?", filter.To)
	}
	if filter.UserID != nil {
		query = query.Where("s.user_id = ?", *filter.UserID)
	}
	if filter.DepartmentID != nil {
		query = query.Where("u.department_id = ?", *filter.DepartmentID)
	}
	if filter.Status != nil {
		query = query.Where("s.status = ?", *filter.Status)
	}
	
	err := query.Order("s.work_date DESC, s.created_at DESC").Scan(&rows).Error
	return rows, err
}

func (r *Repo) FindByID(ctx context.Context, id uint) (*Session, error) {
	var s Session
	if err := r.db.WithContext(ctx).Where("id = ?", id).First(&s).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repo) Update(ctx context.Context, session *Session) error {
	return r.db.WithContext(ctx).Save(session).Error
}

func (r *Repo) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&Session{}, id).Error
}