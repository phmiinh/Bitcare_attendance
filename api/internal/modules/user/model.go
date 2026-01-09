package user

import (
	"time"

	"gorm.io/gorm"
)

// User represents a user in the system.
type User struct {
	ID           uint           `gorm:"primaryKey"`
	Name         string         `gorm:"size:120;not null"`
	Email        string         `gorm:"size:190;uniqueIndex;not null"`
	PasswordHash string         `gorm:"size:255;not null"`
	Role         string         `gorm:"type:enum('user','admin');not null;default:'user'"`
	Status       string         `gorm:"type:enum('active','disabled');not null;default:'active'"`
	DepartmentID *uint          `gorm:"index"`
	Department   *Department    `gorm:"foreignKey:DepartmentID"`
	Birthday     *time.Time     `gorm:"type:date"` // Ngày sinh nhật
	PaidLeave    float64        `gorm:"type:decimal(5,1);not null;default:0.0"` // Số ngày nghỉ phép
	CreatedAt    time.Time      `gorm:"not null"`
	UpdatedAt    time.Time      `gorm:"not null"`
	DeletedAt    gorm.DeletedAt `gorm:"index"`
}

// TableName specifies the table name for the User model.
func (User) TableName() string {
	return "users"
}

// GetID returns the user's ID.
func (u *User) GetID() uint {
	return u.ID
}

// GetRole returns the user's role.
func (u *User) GetRole() string {
	return u.Role
}

// IsActive checks if the user is active.
func (u *User) IsActive() bool {
	return u.Status == "active"
}

// IsAdmin checks if the user has admin role.
func (u *User) IsAdmin() bool {
	return u.Role == "admin"
}

// Department represents a department in the system.
type Department struct {
	ID        uint      `gorm:"primaryKey"`
	Name      string    `gorm:"size:120;uniqueIndex;not null"`
	Code      *string   `gorm:"size:50;uniqueIndex"`
	CreatedAt time.Time `gorm:"not null"`
	UpdatedAt time.Time `gorm:"not null"`
}

// TableName specifies the table name for the Department model.
func (Department) TableName() string {
	return "departments"
}
