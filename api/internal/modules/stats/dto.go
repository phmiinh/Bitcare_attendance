package stats

type MeStatsResponse struct {
	Range               string           `json:"range"`
	TotalWorkedMinutes  int              `json:"totalWorkedMinutes"`
	WorkedDays          int              `json:"workedDays"`
	TotalDayUnit        float64          `json:"totalDayUnit"`
	FullDays            int              `json:"fullDays"`
	HalfDays            int              `json:"halfDays"`
	MissingDays         int              `json:"missingDays"`
	Anomalies           AnomalyStats     `json:"anomalies"`
	PrevMonthComparison *MonthComparison `json:"prevMonthComparison,omitempty"`
	Series              []MeStatsPoint   `json:"series"`
}

type MonthComparison struct {
	// Raw totals for current and previous month (used to compute averages correctly on FE)
	CurrentTotalWorkedMinutes int `json:"currentTotalWorkedMinutes"`
	CurrentWorkedDays         int `json:"currentWorkedDays"`
	PrevTotalWorkedMinutes    int `json:"prevTotalWorkedMinutes"`
	PrevWorkedDays            int `json:"prevWorkedDays"`

	// Kept for backward compatibility (total deltas)
	WorkedMinutesDelta int     `json:"workedMinutesDelta"`
	DayUnitDelta       float64 `json:"dayUnitDelta"`
	WorkedDaysDelta    int     `json:"workedDaysDelta"`
}

type AnomalyStats struct {
	Total           int `json:"total"`
	MissingCheckOut int `json:"missingCheckOut"`
	MissingCheckIn  int `json:"missingCheckIn"`
}

type MeStatsPoint struct {
	WorkDate      string       `json:"workDate"`
	WorkedMinutes int          `json:"workedMinutes"`
	DayUnit       float32      `json:"dayUnit"`
	Anomalies     AnomalyStats `json:"anomalies"`
}

// Admin DTOs
type AdminTodayOpsResponse struct {
	UsersActive    int `json:"usersActive"`
	CheckedIn      int `json:"checkedIn"`
	NotCheckedIn  int `json:"notCheckedIn"`
	OpenSessions   int `json:"openSessions"`
	MissingCheckout int `json:"missingCheckout"`
	Anomalies      int `json:"anomalies"`
}

type AdminTopIssuesResponse struct {
	TopLate []TopIssueItem `json:"topLate"`
	TopEarly []TopIssueItem `json:"topEarly"`
	TopMissing []TopIssueItem `json:"topMissing"`
}

type TopIssueItem struct {
	UserID         uint   `json:"userId"`
	Name           string `json:"name"`
	Count          int    `json:"count"`
	DepartmentName *string `json:"departmentName,omitempty"`
}
