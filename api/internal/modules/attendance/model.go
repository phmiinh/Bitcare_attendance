package attendance

import (
	"time"
)

// Session represents an attendance session for a user on a specific date.
// It is mapped to table attendance_sessions.
// Business rules around computation of WorkedMinutes / DayUnit are handled in service layer.
type Session struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	UserID        uint       `gorm:"not null;index:idx_user_date,priority:1;uniqueIndex:uq_user_work_date,priority:1" json:"userId"`
	WorkDate      time.Time  `gorm:"type:date;not null;index:idx_work_date,priority:1;index:idx_user_date,priority:2;uniqueIndex:uq_user_work_date,priority:2" json:"workDate"`
	CheckInAt     time.Time  `gorm:"not null" json:"checkInAt"`
	CheckOutAt    *time.Time `json:"checkOutAt"`
	WorkedMinutes int        `gorm:"not null;default:0" json:"workedMinutes"`
	DayUnit       float32    `gorm:"type:decimal(2,1);not null;default:0.0" json:"dayUnit"`

	Status         string  `gorm:"type:enum('OPEN','CLOSED');not null;default:'OPEN'" json:"status"`
	CheckoutReason *string `gorm:"type:text" json:"checkoutReason"`

	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

func (Session) TableName() string { return "attendance_sessions" }
