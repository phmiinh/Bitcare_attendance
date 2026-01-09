package leave

import "time"

// LeaveMonthlySummaryResponse represents monthly summary
type LeaveMonthlySummaryResponse struct {
	UserID        uint      `json:"userId"`
	Year          int       `json:"year"`
	Month         int       `json:"month"`
	ExpectedUnits float64   `json:"expectedUnits"`
	WorkedUnits   float64   `json:"workedUnits"`
	MissingUnits  float64   `json:"missingUnits"`
	PaidUsedUnits float64   `json:"paidUsedUnits"`
	UnpaidUnits   float64   `json:"unpaidUnits"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

