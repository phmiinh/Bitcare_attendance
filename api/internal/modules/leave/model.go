package leave

import (
	"time"

	"gorm.io/gorm"
)

// LeaveGrant tracks monthly leave grants to prevent duplicate grants
// Note: user_id column is no longer used - all grants are for all active users
type LeaveGrant struct {
	ID        uint           `gorm:"primaryKey"`
	GrantYear int            `gorm:"not null"`
	GrantMonth int           `gorm:"not null"`
	GrantType string         `gorm:"type:enum('MONTHLY');not null"` // Only MONTHLY is used now
	CreatedAt time.Time      `gorm:"not null"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

func (LeaveGrant) TableName() string {
	return "leave_grants"
}

const (
	GrantTypeMonthly        = "MONTHLY"
	GrantTypeBirthday       = "BIRTHDAY"
	GrantTypeBirthdayDeduction = "BIRTHDAY_DEDUCTION"
)

