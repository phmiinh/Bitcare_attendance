package department

import "time"

type Department struct {
	ID        uint      `gorm:"primaryKey"`
	Name      string    `gorm:"size:120;not null;uniqueIndex"`
	Code      *string   `gorm:"size:50;uniqueIndex"`
	CreatedAt time.Time `gorm:"not null"`
	UpdatedAt time.Time `gorm:"not null"`
}

func (Department) TableName() string { return "departments" }

















