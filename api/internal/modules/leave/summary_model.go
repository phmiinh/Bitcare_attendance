package leave

import "time"

type MonthlySummary struct {
	UserID        uint    `gorm:"primaryKey"`
	Year          int     `gorm:"primaryKey"`
	Month         int     `gorm:"primaryKey"`
	ExpectedUnits float64 `gorm:"type:decimal(6,2);not null;default:0.0"`
	WorkedUnits   float64 `gorm:"type:decimal(6,2);not null;default:0.0"`
	MissingUnits  float64 `gorm:"type:decimal(6,2);not null;default:0.0"`
	PaidUsedUnits float64 `gorm:"type:decimal(6,2);not null;default:0.0"`
	UnpaidUnits   float64 `gorm:"type:decimal(6,2);not null;default:0.0"`
	IsBirthday    bool    `gorm:"type:tinyint(1);not null;default:0" json:"isBirthday"`
	UpdatedAt     time.Time `gorm:"not null"`
}

func (MonthlySummary) TableName() string {
	return "leave_monthly_summary"
}

