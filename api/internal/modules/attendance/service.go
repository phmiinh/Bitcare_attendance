package attendance

import (
	"context"
	"errors"
	"time"

	"time-attendance-be/internal/config"
	"time-attendance-be/internal/modules/user"
	"time-attendance-be/internal/pkg/clock"

	"gorm.io/gorm"
)

// LeaveUsageInfo represents leave usage information (to avoid circular dependency)
type LeaveUsageInfo struct {
	UsageDate  time.Time
	IsUnpaid   bool
}

type Service struct {
	cfg         *config.Config
	attRepo     *Repo
	userRepo    UserRepo
	clock       clock.Clock
}

type UserRepo interface {
	GetByID(ctx context.Context, id uint) (*user.User, error)
}

func NewService(cfg *config.Config, attRepo *Repo, clock clock.Clock) *Service {
	return &Service{
		cfg:     cfg,
		attRepo: attRepo,
		clock:   clock,
	}
}

func (s *Service) SetUserRepo(repo UserRepo) {
	s.userRepo = repo
}

func (s *Service) GetToday(ctx context.Context, userID uint) (*Session, error) {
	today := s.clock.Now().Format("2006-01-02")
	session, err := s.attRepo.FindByUserDate(userID, today)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &Session{UserID: userID, WorkDate: s.clock.Now(), Status: "NOT_CHECKED_IN"}, nil
		}
		return nil, err
	}
	return session, nil
}

func (s *Service) CheckIn(ctx context.Context, userID uint) (*Session, error) {
	loc := s.cfg.TimeLocation()
	now := s.clock.Now().In(loc)
	today := now.Format("2006-01-02")

	if !IsCheckInAllowed(now) {
		return nil, errors.New("check-in not allowed outside working hours")
	}

	_, err := s.attRepo.FindByUserDate(userID, today)
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("already checked in today")
	}

	workDate := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	dayUnit := ComputeDayUnit(&now, nil, loc)

	newSession := &Session{
		UserID:        userID,
		WorkDate:      workDate,
		CheckInAt:     now,
		CheckOutAt:    nil,
		WorkedMinutes: 0,
		DayUnit:       dayUnit,
		Status:        "OPEN",
	}

	if err := s.attRepo.Create(newSession); err != nil {
		return nil, err
	}

	return newSession, nil
}

func (s *Service) CheckOut(ctx context.Context, userID uint, reason *string) (*Session, error) {
	loc := s.cfg.TimeLocation()
	now := s.clock.Now().In(loc)
	today := now.Format("2006-01-02")

	session, err := s.attRepo.FindByUserDate(userID, today)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		session, err = s.attRepo.FindLatestOpen(userID)
		if err != nil {
			return nil, errors.New("no open session found to check out")
		}
	} else if err != nil {
		return nil, err
	}

	session.CheckOutAt = &now
	session.Status = "CLOSED"
	if reason != nil {
		session.CheckoutReason = reason
	}

	session.WorkedMinutes = ComputeWorkedMinutes(session.CheckInAt, *session.CheckOutAt, loc)
	session.DayUnit = ComputeDayUnit(&session.CheckInAt, session.CheckOutAt, loc)

	if err := s.attRepo.Save(session); err != nil {
		return nil, err
	}

	return session, nil
}

func (s *Service) ListMe(ctx context.Context, userID uint, from, to string) (*ListMeResponse, error) {
	if from == "" || to == "" {
		now := s.clock.Now()
		firstOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		lastOfMonth := firstOfMonth.AddDate(0, 1, 0).Add(-1 * time.Second)
		if from == "" {
			from = firstOfMonth.Format("2006-01-02")
		}
		if to == "" {
			to = lastOfMonth.Format("2006-01-02")
		}
	}

	rows, err := s.attRepo.ListByUserDateRange(userID, from, to)
	if err != nil {
		return nil, err
	}

	// Leave usage map (optional; empty in new design)
	leaveUsageMap := make(map[string]LeaveUsageInfo)

	loc := s.cfg.TimeLocation()
	listRows := make([]TodayListRow, 0, len(rows))
	for i := range rows {
		tr := toTodayResponse(&rows[i], loc)
		dateStr := tr.WorkDate
		
		// Check if this date has leave usage
		isLeave := false
		isUnpaidLeave := false
		if usage, exists := leaveUsageMap[dateStr]; exists {
			isLeave = true
			isUnpaidLeave = usage.IsUnpaid
		}
		
		listRows = append(listRows, TodayListRow{
			WorkDate:      tr.WorkDate,
			CheckInAt:     tr.CheckInAt,
			CheckOutAt:    tr.CheckOutAt,
			WorkedMinutes: tr.WorkedMinutes,
			DayUnit:       tr.DayUnit,
			Status:        tr.Status,
			NotePreview:   nil,
			IsLeave:       isLeave,
			IsUnpaidLeave: isUnpaidLeave,
		})
	}

	return &ListMeResponse{From: from, To: to, Rows: listRows}, nil
}

// Admin service methods
type AdminListResponse struct {
	From string             `json:"from"`
	To   string             `json:"to"`
	Rows []AdminSessionDTO  `json:"rows"`
}

// AdminSessionDTO is the flattened DTO returned to API clients.
// It is built from the AdminSessionRow defined in repo.go.
type AdminSessionDTO struct {
	ID             uint    `json:"id"`
	UserID         uint    `json:"userId"`
	UserName       string  `json:"userName"`
	DepartmentName string  `json:"departmentName,omitempty"`
	WorkDate       string  `json:"workDate"`
	CheckInAt      string  `json:"checkInAt"`
	CheckOutAt     string  `json:"checkOutAt"`
	WorkedMinutes  int     `json:"workedMinutes"`
	DayUnit        float32 `json:"dayUnit"`
	Status         string  `json:"status"`
	CheckoutReason string  `json:"checkoutReason,omitempty"`
	CreatedAt      string  `json:"createdAt"`
	UpdatedAt      string  `json:"updatedAt"`
}

func (s *Service) ListAdmin(ctx context.Context, filter AdminListFilter) (*AdminListResponse, error) {
	rows, err := s.attRepo.ListAdmin(ctx, filter)
	if err != nil {
		return nil, err
	}

	loc := s.cfg.TimeLocation()
	layout := time.RFC3339
	adminRows := make([]AdminSessionDTO, len(rows))
	for i, row := range rows {
		ci := ""
		co := ""
		if !row.CheckInAt.IsZero() {
			ci = row.CheckInAt.In(loc).Format("15:04:05")
		}
		if row.CheckOutAt != nil {
			co = row.CheckOutAt.In(loc).Format("15:04:05")
		}

		deptName := ""
		if row.DepartmentName != nil {
			deptName = *row.DepartmentName
		}

		checkoutReason := ""
		if row.CheckoutReason != nil {
			checkoutReason = *row.CheckoutReason
		}

		adminRows[i] = AdminSessionDTO{
			ID:             row.ID,
			UserID:         row.UserID,
			UserName:       row.UserName,
			DepartmentName: deptName,
			WorkDate:       row.WorkDate.Format("2006-01-02"),
			CheckInAt:      ci,
			CheckOutAt:     co,
			WorkedMinutes:  row.WorkedMinutes,
			DayUnit:        row.DayUnit,
			Status:         row.Status,
			CheckoutReason: checkoutReason,
			CreatedAt:      row.CreatedAt.In(loc).Format(layout),
			UpdatedAt:      row.UpdatedAt.In(loc).Format(layout),
		}
	}

	return &AdminListResponse{
		From: filter.From,
		To:   filter.To,
		Rows: adminRows,
	}, nil
}

type CreateManualRequest struct {
	UserID     uint
	WorkDate   string
	CheckInAt  string
	CheckOutAt *string
	Reason     string
}

func (s *Service) CreateManual(ctx context.Context, req CreateManualRequest) (*Session, error) {
	loc := s.cfg.TimeLocation()
	
	// Parse work date
	workDate, err := time.Parse("2006-01-02", req.WorkDate)
	if err != nil {
		return nil, errors.New("invalid work date format")
	}
	workDate = time.Date(workDate.Year(), workDate.Month(), workDate.Day(), 0, 0, 0, 0, loc)

	// Parse check-in time
	checkInAt, err := time.Parse(time.RFC3339, req.CheckInAt)
	if err != nil {
		return nil, errors.New("invalid check-in time format")
	}
	checkInAt = checkInAt.In(loc)

	var checkOutAt *time.Time
	var workedMinutes int
	var dayUnit float32
	status := "OPEN"

	if req.CheckOutAt != nil {
		co, err := time.Parse(time.RFC3339, *req.CheckOutAt)
		if err != nil {
			return nil, errors.New("invalid check-out time format")
		}
		co = co.In(loc)
		checkOutAt = &co
		workedMinutes = ComputeWorkedMinutes(checkInAt, *checkOutAt, loc)
		dayUnit = ComputeDayUnit(&checkInAt, checkOutAt, loc)
		status = "CLOSED"
	} else {
		dayUnit = ComputeDayUnit(&checkInAt, nil, loc)
	}

	session := &Session{
		UserID:        req.UserID,
		WorkDate:      workDate,
		CheckInAt:     checkInAt,
		CheckOutAt:    checkOutAt,
		WorkedMinutes: workedMinutes,
		DayUnit:       dayUnit,
		Status:        status,
		CheckoutReason: &req.Reason,
	}

	if err := s.attRepo.Create(session); err != nil {
		return nil, err
	}

	return session, nil
}

type UpdateSessionRequest struct {
	CheckInAt  *string
	CheckOutAt *string
	Reason     string
	// Optional fields for creating new session if not found
	UserID   *uint
	WorkDate *string
}

func (s *Service) UpdateSession(ctx context.Context, id uint, req UpdateSessionRequest) (*Session, error) {
	session, err := s.attRepo.FindByID(ctx, id)
	
	// If session not found and we have userId and workDate, create a new session
	if errors.Is(err, gorm.ErrRecordNotFound) {
		if req.UserID == nil || req.WorkDate == nil {
			return nil, errors.New("session not found. Please provide userId and workDate to create a new session")
		}
		
		// Create new session
		loc := s.cfg.TimeLocation()
		
		// Parse work date
		workDate, err := time.Parse("2006-01-02", *req.WorkDate)
		if err != nil {
			return nil, errors.New("invalid work date format")
		}
		workDate = time.Date(workDate.Year(), workDate.Month(), workDate.Day(), 0, 0, 0, 0, loc)
		
		// Parse check-in time (required for new session)
		if req.CheckInAt == nil {
			return nil, errors.New("checkInAt is required when creating a new session")
		}
		checkInAt, err := time.Parse(time.RFC3339, *req.CheckInAt)
		if err != nil {
			return nil, errors.New("invalid check-in time format")
		}
		checkInAt = checkInAt.In(loc)
		
		var checkOutAt *time.Time
		var workedMinutes int
		var dayUnit float32
		status := "OPEN"
		
		if req.CheckOutAt != nil {
			co, err := time.Parse(time.RFC3339, *req.CheckOutAt)
			if err != nil {
				return nil, errors.New("invalid check-out time format")
			}
			co = co.In(loc)
			checkOutAt = &co
			workedMinutes = ComputeWorkedMinutes(checkInAt, *checkOutAt, loc)
			dayUnit = ComputeDayUnit(&checkInAt, checkOutAt, loc)
			status = "CLOSED"
		} else {
			dayUnit = ComputeDayUnit(&checkInAt, nil, loc)
		}
		
		newSession := &Session{
			UserID:        *req.UserID,
			WorkDate:      workDate,
			CheckInAt:     checkInAt,
			CheckOutAt:    checkOutAt,
			WorkedMinutes: workedMinutes,
			DayUnit:       dayUnit,
			Status:        status,
			CheckoutReason: &req.Reason,
		}
		
		if err := s.attRepo.Create(newSession); err != nil {
			return nil, err
		}
		
		return newSession, nil
	}
	
	if err != nil {
		return nil, err
	}

	// Update existing session
	loc := s.cfg.TimeLocation()

	if req.CheckInAt != nil {
		ci, err := time.Parse(time.RFC3339, *req.CheckInAt)
		if err != nil {
			return nil, errors.New("invalid check-in time format")
		}
		session.CheckInAt = ci.In(loc)
	}

	if req.CheckOutAt != nil {
		co, err := time.Parse(time.RFC3339, *req.CheckOutAt)
		if err != nil {
			return nil, errors.New("invalid check-out time format")
		}
		session.CheckOutAt = &co
		session.Status = "CLOSED"
	} else if session.CheckOutAt != nil {
		// If check-out is removed, set status back to OPEN
		session.Status = "OPEN"
		session.CheckOutAt = nil
	}

	if session.CheckOutAt != nil {
		session.WorkedMinutes = ComputeWorkedMinutes(session.CheckInAt, *session.CheckOutAt, loc)
		session.DayUnit = ComputeDayUnit(&session.CheckInAt, session.CheckOutAt, loc)
	} else {
		session.WorkedMinutes = 0
		session.DayUnit = ComputeDayUnit(&session.CheckInAt, nil, loc)
	}

	if req.Reason != "" {
		session.CheckoutReason = &req.Reason
	}

	if err := s.attRepo.Update(ctx, session); err != nil {
		return nil, err
	}

	return session, nil
}

func (s *Service) CloseSession(ctx context.Context, id uint, checkOutAt string, reason string) (*Session, error) {
	session, err := s.attRepo.FindByID(ctx, id)
	if err != nil {
		return nil, err
	}

	loc := s.cfg.TimeLocation()
	co, err := time.Parse(time.RFC3339, checkOutAt)
	if err != nil {
		return nil, errors.New("invalid check-out time format")
	}
	co = co.In(loc)

	session.CheckOutAt = &co
	session.Status = "CLOSED"
	session.CheckoutReason = &reason
	session.WorkedMinutes = ComputeWorkedMinutes(session.CheckInAt, *session.CheckOutAt, loc)
	session.DayUnit = ComputeDayUnit(&session.CheckInAt, session.CheckOutAt, loc)

	if err := s.attRepo.Update(ctx, session); err != nil {
		return nil, err
	}

	return session, nil
}

func (s *Service) DeleteSession(ctx context.Context, id uint) error {
	return s.attRepo.Delete(ctx, id)
}