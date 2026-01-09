package leave

import (
	"time"

	"gorm.io/gorm"
)

// LeaveUsage tracks when and how users use their paid leave
// Each record represents a specific day of leave usage
// Note: Unpaid leave records are historical data and don't reset monthly
type LeaveUsage struct {
	ID         uint           `gorm:"primaryKey"`
	UserID     uint           `gorm:"not null;index:idx_user_usage_date"`
	UsageDate  time.Time      `gorm:"type:date;not null;index:idx_user_usage_date"`
	DaysUsed   float64        `gorm:"type:decimal(5,1);not null;default:1.0"`
	LeaveType  string         `gorm:"type:enum('REGULAR','BIRTHDAY');not null;default:'REGULAR'"`
	IsUnpaid   bool           `gorm:"not null;default:false;index"` // true = nghỉ không phép (unpaid leave)
	Source     string         `gorm:"type:enum('AUTO_ABSENCE','AUTO_DAY_UNIT_ZERO','MANUAL','BIRTHDAY');not null;default:'MANUAL'"`
	SourceRef  *string        `gorm:"type:varchar(64);index:idx_leave_usage_source,priority:2"`
	RecordStatus string       `gorm:"type:enum('ACTIVE','VOIDED');not null;default:'ACTIVE'"`
	Reason     *string        `gorm:"type:text"`
	CreatedAt  time.Time      `gorm:"not null"`
	UpdatedAt  time.Time      `gorm:"not null"`
	DeletedAt  gorm.DeletedAt `gorm:"index"`
}

func (LeaveUsage) TableName() string {
	return "leave_usage"
}

const (
	LeaveTypeRegular  = "REGULAR"
	LeaveTypeBirthday = "BIRTHDAY"

	SourceAutoAbsence     = "AUTO_ABSENCE"
	SourceAutoDayUnitZero = "AUTO_DAY_UNIT_ZERO"
	SourceManual          = "MANUAL"
	SourceBirthday        = "BIRTHDAY"
)

