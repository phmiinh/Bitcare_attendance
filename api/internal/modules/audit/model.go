package audit

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

type AuditLog struct {
	ID         uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	AdminUserID uint          `gorm:"not null;index" json:"adminUserId"`
	ActionType string         `gorm:"type:varchar(50);not null" json:"actionType"`
	EntityType string         `gorm:"type:varchar(50);not null;index:idx_entity" json:"entityType"`
	EntityID   string         `gorm:"type:varchar(255);not null;index:idx_entity" json:"entityId"`
	BeforeJSON JSONB          `gorm:"type:json" json:"beforeJson,omitempty"`
	AfterJSON  JSONB          `gorm:"type:json" json:"afterJson,omitempty"`
	Reason     string         `gorm:"type:text" json:"reason"`
	CreatedAt  time.Time      `gorm:"not null;index" json:"createdAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (AuditLog) TableName() string {
	return "admin_audit_logs"
}

// JSONB type for JSON fields
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	if j == nil {
		return nil, nil
	}
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, j)
}
