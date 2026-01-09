package attendance

import "time"

// TodayResponse matches GET /api/v1/attendance/today and check-in/out responses
// and row shape for list endpoints.

type TodayResponse struct {
    WorkDate      string   `json:"workDate"`
    CheckInAt     *string  `json:"checkInAt"`
    CheckOutAt    *string  `json:"checkOutAt"`
    WorkedMinutes int      `json:"workedMinutes"`
    DayUnit       float32  `json:"dayUnit"`

    Status        string   `json:"status"`
}

func toTodayResponse(s *Session, loc *time.Location) TodayResponse {
    layout := time.RFC3339
    var ci, co *string
    if !s.CheckInAt.IsZero() {
        t := s.CheckInAt.In(loc).Format(layout)
        ci = &t
    }
    if s.CheckOutAt != nil {
        t := s.CheckOutAt.In(loc).Format(layout)
        co = &t
    }
    return TodayResponse{
        WorkDate:      s.WorkDate.Format("2006-01-02"),
        CheckInAt:     ci,
        CheckOutAt:    co,
        WorkedMinutes: s.WorkedMinutes,
        DayUnit:       s.DayUnit,
        Status:        s.Status,
    }
}

type ListMeResponse struct {
    From string               `json:"from"`
    To   string               `json:"to"`
    Rows []TodayListRow `json:"rows"`
}

type TodayListRow struct {
    WorkDate      string  `json:"workDate"`
    CheckInAt     *string `json:"checkInAt"`
    CheckOutAt    *string `json:"checkOutAt"`
    WorkedMinutes int     `json:"workedMinutes"`
    DayUnit       float32 `json:"dayUnit"`
    NotePreview   *string `json:"notePreview"`
    Status        string  `json:"status"`
    IsLeave       bool    `json:"isLeave"`       // true if this day is marked as leave
    IsUnpaidLeave bool    `json:"isUnpaidLeave"` // true if this is unpaid leave
}

