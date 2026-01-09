package stats

import (
	"context"

	"gorm.io/gorm"
)

type Repo struct {
	db *gorm.DB
}

func NewRepo(db *gorm.DB) *Repo { return &Repo{db: db} }

type Row struct {
	WorkDate      string
	WorkedMinutes int
	DayUnit       float32
	Status        string
	CheckOutAt    *string      // nullable
	CheckInAt     *string      // nullable
	Anomalies     AnomalyStats `gorm:"-"`
}

func (r *Repo) MeRange(ctx context.Context, userID uint, from, to string) ([]Row, error) {
	rows := []Row{}
	err := r.db.WithContext(ctx).
		Table("attendance_sessions").
		Select("work_date as work_date, worked_minutes as worked_minutes, day_unit as day_unit, status as status, check_out_at as check_out_at, check_in_at as check_in_at").
		Where("user_id = ? AND work_date >= ? AND work_date <= ?", userID, from, to).
		Order("work_date asc").
		Scan(&rows).Error

	if err == nil {
		detectAnomalies(rows)
	}

	return rows, err
}

func (r *Repo) MeRangeCompare(ctx context.Context, userID uint, from, to, prevFrom, prevTo string) (current []Row, previous []Row, err error) {
	// Get current period data
	current, err = r.MeRange(ctx, userID, from, to)
	if err != nil {
		return nil, nil, err
	}

	// Get previous period data if needed
	if prevFrom != "" && prevTo != "" {
		previous, err = r.MeRange(ctx, userID, prevFrom, prevTo)
		if err != nil {
			return nil, nil, err
		}
	}

	return current, previous, nil
}

func detectAnomalies(rows []Row) {
	for i := range rows {
		row := &rows[i]
		row.Anomalies = AnomalyStats{}

		// Missing check-in
		if row.Status == "MISSING" || row.Status == "ABSENT" {
			row.Anomalies.MissingCheckIn = 1
		}

		// Missing check-out (checked in but no check-out)
		if row.Status == "OPEN" && row.CheckOutAt == nil {
			row.Anomalies.MissingCheckOut = 1
		}

		row.Anomalies.Total = row.Anomalies.MissingCheckIn + row.Anomalies.MissingCheckOut
	}
}

// Admin repo methods
type TodayOpsData struct {
	UsersActive     int
	CheckedIn       int
	NotCheckedIn    int
	OpenSessions    int
	MissingCheckout int
	Anomalies       int
}

func (r *Repo) GetTodayOps(ctx context.Context, today string) (*TodayOpsData, error) {
	var data TodayOpsData

	// Count active users (users with status = 'active')
	var cnt int64
	err := r.db.WithContext(ctx).
		Table("users").
		Where("status = ?", "active").
		Count(&cnt).Error
	if err != nil {
		return nil, err
	}
	data.UsersActive = int(cnt)

	// Count checked in today
	cnt = 0
	err = r.db.WithContext(ctx).
		Table("attendance_sessions").
		Where("work_date = ? AND check_in_at IS NOT NULL", today).
		Count(&cnt).Error
	if err != nil {
		return nil, err
	}
	data.CheckedIn = int(cnt)

	// Not checked in = active users - checked in
	data.NotCheckedIn = data.UsersActive - data.CheckedIn

	// Open sessions (checked in but not checked out)
	cnt = 0
	err = r.db.WithContext(ctx).
		Table("attendance_sessions").
		Where("work_date = ? AND status = ?", today, "OPEN").
		Count(&cnt).Error
	if err != nil {
		return nil, err
	}
	data.OpenSessions = int(cnt)

	// Missing checkout (checked in but no checkout, and it's past 19:00 or next day)
	cnt = 0
	err = r.db.WithContext(ctx).
		Table("attendance_sessions").
		Where("work_date = ? AND status = ? AND check_out_at IS NULL", today, "OPEN").
		Count(&cnt).Error
	if err != nil {
		return nil, err
	}
	data.MissingCheckout = int(cnt)

	// Anomalies (OPEN sessions + MISSING status)
	var anomalies int64
	err = r.db.WithContext(ctx).
		Table("attendance_sessions").
		Where("work_date = ? AND (status = ? OR status = ?)", today, "OPEN", "MISSING").
		Count(&anomalies).Error
	if err != nil {
		return nil, err
	}
	data.Anomalies = int(anomalies)

	return &data, nil
}

type TopIssueRow struct {
	UserID         uint
	Name           string
	Count          int
	DepartmentName *string
}

func (r *Repo) GetTopLate(ctx context.Context, days int) ([]TopIssueRow, error) {
	var rows []TopIssueRow

	// Get top users with most late arrivals in last N days
	// Late = check_in_at > 08:30 (we'll use 08:31 as threshold)
	err := r.db.WithContext(ctx).
		Table("attendance_sessions AS s").
		Select("u.id as user_id, u.name, COUNT(*) as count, d.name as department_name").
		Joins("INNER JOIN users u ON s.user_id = u.id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Where("s.work_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", days).
		Where("s.check_in_at IS NOT NULL").
		Where("TIME(s.check_in_at) > '08:30:00'").
		Where("s.status != 'MISSING'").
		Group("u.id, u.name, d.name").
		Order("count DESC").
		Limit(5).
		Scan(&rows).Error

	return rows, err
}

func (r *Repo) GetTopEarly(ctx context.Context, days int) ([]TopIssueRow, error) {
	var rows []TopIssueRow

	// Get top users with most early leaves in last N days
	// Early = check_out_at < 18:00
	err := r.db.WithContext(ctx).
		Table("attendance_sessions AS s").
		Select("u.id as user_id, u.name, COUNT(*) as count, d.name as department_name").
		Joins("INNER JOIN users u ON s.user_id = u.id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Where("s.work_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", days).
		Where("s.check_out_at IS NOT NULL").
		Where("TIME(s.check_out_at) < '18:00:00'").
		Where("s.status = 'CLOSED'").
		Group("u.id, u.name, d.name").
		Order("count DESC").
		Limit(5).
		Scan(&rows).Error

	return rows, err
}

func (r *Repo) GetTopMissing(ctx context.Context, days int) ([]TopIssueRow, error) {
	var rows []TopIssueRow

	// Get top users with most missing punches in last N days
	err := r.db.WithContext(ctx).
		Table("attendance_sessions AS s").
		Select("u.id as user_id, u.name, COUNT(*) as count, d.name as department_name").
		Joins("INNER JOIN users u ON s.user_id = u.id").
		Joins("LEFT JOIN departments d ON u.department_id = d.id").
		Where("s.work_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)", days).
		Where("s.status = 'MISSING' OR (s.check_in_at IS NULL AND s.check_out_at IS NULL)").
		Group("u.id, u.name, d.name").
		Order("count DESC").
		Limit(5).
		Scan(&rows).Error

	return rows, err
}
