package stats

import (
	"context"
	"time"

	"time-attendance-be/internal/config"
	"time-attendance-be/internal/pkg/clock"
	"time-attendance-be/internal/pkg/response"
)

type Service struct {
	cfg   *config.Config
	repo  *Repo
	clock clock.Clock
}

func NewService(cfg *config.Config, repo *Repo, clock clock.Clock) *Service {
	return &Service{cfg: cfg, repo: repo, clock: clock}
}

func (s *Service) GetMeStats(ctx context.Context, userID uint, queryRange, value string) (*MeStatsResponse, error) {
	loc := s.cfg.TimeLocation()
	from, to, err := parseRange(loc, queryRange, value)
	if err != nil {
		return nil, err
	}

	fromStr := from.Format("2006-01-02")
	toStr := to.Format("2006-01-02")

	// Previous month range (same timezone), used for comparison in UI
	prevFrom := from.AddDate(0, -1, 0)
	prevTo := from.Add(-24 * time.Hour)
	prevFromStr := prevFrom.Format("2006-01-02")
	prevToStr := prevTo.Format("2006-01-02")

	currentRows, prevRows, err := s.repo.MeRangeCompare(ctx, userID, fromStr, toStr, prevFromStr, prevToStr)
	if err != nil {
		return nil, response.Internal(err)
	}

	resp := MeStatsResponse{
		Range:  queryRange,
		Series: make([]MeStatsPoint, len(currentRows)),
	}

	// Current aggregates
	for i, row := range currentRows {
		dayUnit := row.DayUnit
		// Note: attendance module now computes day_unit based on half-day model.
		// Keep this fallback for legacy OPEN rows without checkout.
		if row.Status == "OPEN" && row.CheckOutAt == nil {
			dayUnit = 0.5
		}

		resp.TotalWorkedMinutes += row.WorkedMinutes
		if row.WorkedMinutes > 0 {
			resp.WorkedDays++
		}
		resp.TotalDayUnit += float64(dayUnit)

		if dayUnit >= 1.0 {
			resp.FullDays++
		} else if dayUnit >= 0.5 {
			resp.HalfDays++
		} else {
			resp.MissingDays++
		}

		resp.Anomalies.Total += row.Anomalies.Total
		resp.Anomalies.MissingCheckIn += row.Anomalies.MissingCheckIn
		resp.Anomalies.MissingCheckOut += row.Anomalies.MissingCheckOut

		resp.Series[i] = MeStatsPoint{
			WorkDate:      row.WorkDate,
			WorkedMinutes: row.WorkedMinutes,
			DayUnit:       dayUnit,
			Anomalies:     row.Anomalies,
		}
	}

	// Previous month comparison
	if len(prevRows) > 0 {
		var prevWorkedMinutes int
		var prevWorkedDays int
		var prevDayUnit float64
		for _, row := range prevRows {
			dayUnit := row.DayUnit
			if row.Status == "OPEN" && row.CheckOutAt == nil {
				dayUnit = 0.5
			}
			prevWorkedMinutes += row.WorkedMinutes
			if row.WorkedMinutes > 0 {
				prevWorkedDays++
			}
			prevDayUnit += float64(dayUnit)
		}

		resp.PrevMonthComparison = &MonthComparison{
			CurrentTotalWorkedMinutes: resp.TotalWorkedMinutes,
			CurrentWorkedDays:         resp.WorkedDays,
			PrevTotalWorkedMinutes:    prevWorkedMinutes,
			PrevWorkedDays:            prevWorkedDays,

			// Backward compatible deltas
			WorkedMinutesDelta: resp.TotalWorkedMinutes - prevWorkedMinutes,
			DayUnitDelta:       resp.TotalDayUnit - prevDayUnit,
			WorkedDaysDelta:    resp.WorkedDays - prevWorkedDays,
		}
	}

	return &resp, nil
}

func parseRange(loc *time.Location, queryRange, value string) (time.Time, time.Time, error) {
	now := time.Now().In(loc)
	var from, to time.Time

	if queryRange == "year" {
		y, err := time.Parse("2006", value)
		if err != nil {
			return from, to, response.Validation("Invalid year format", nil)
		}
		from = time.Date(y.Year(), 1, 1, 0, 0, 0, 0, loc)
		to = from.AddDate(1, 0, 0).Add(-1 * time.Second)
	} else { // month
		m, err := time.Parse("2006-01", value)
		if err != nil {
			return from, to, response.Validation("Invalid month format", nil)
		}
		from = time.Date(m.Year(), m.Month(), 1, 0, 0, 0, 0, loc)
		to = from.AddDate(0, 1, 0).Add(-1 * time.Second)
	}

	if to.After(now) {
		to = now
	}

	return from, to, nil
}

// Admin service methods
func (s *Service) GetTodayOps(ctx context.Context) (*AdminTodayOpsResponse, error) {
	loc := s.cfg.TimeLocation()
	today := s.clock.Now().In(loc).Format("2006-01-02")
	
	data, err := s.repo.GetTodayOps(ctx, today)
	if err != nil {
		return nil, response.Internal(err)
	}

	return &AdminTodayOpsResponse{
		UsersActive:     data.UsersActive,
		CheckedIn:       data.CheckedIn,
		NotCheckedIn:   data.NotCheckedIn,
		OpenSessions:    data.OpenSessions,
		MissingCheckout: data.MissingCheckout,
		Anomalies:       data.Anomalies,
	}, nil
}

func (s *Service) GetTopIssues(ctx context.Context) (*AdminTopIssuesResponse, error) {
	days := 30 // Last 30 days
	
	topLate, err := s.repo.GetTopLate(ctx, days)
	if err != nil {
		return nil, response.Internal(err)
	}

	topEarly, err := s.repo.GetTopEarly(ctx, days)
	if err != nil {
		return nil, response.Internal(err)
	}

	topMissing, err := s.repo.GetTopMissing(ctx, days)
	if err != nil {
		return nil, response.Internal(err)
	}

	// Convert to DTO
	lateItems := make([]TopIssueItem, len(topLate))
	for i, row := range topLate {
		lateItems[i] = TopIssueItem{
			UserID:         row.UserID,
			Name:           row.Name,
			Count:          row.Count,
			DepartmentName: row.DepartmentName,
		}
	}

	earlyItems := make([]TopIssueItem, len(topEarly))
	for i, row := range topEarly {
		earlyItems[i] = TopIssueItem{
			UserID:         row.UserID,
			Name:           row.Name,
			Count:          row.Count,
			DepartmentName: row.DepartmentName,
		}
	}

	missingItems := make([]TopIssueItem, len(topMissing))
	for i, row := range topMissing {
		missingItems[i] = TopIssueItem{
			UserID:         row.UserID,
			Name:           row.Name,
			Count:          row.Count,
			DepartmentName: row.DepartmentName,
		}
	}

	return &AdminTopIssuesResponse{
		TopLate:   lateItems,
		TopEarly:   earlyItems,
		TopMissing: missingItems,
	}, nil
}
