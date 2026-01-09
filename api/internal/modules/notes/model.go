package notes

import "time"

type DailyNote struct {
    ID        uint      `gorm:"primaryKey" json:"id"`
    UserID    uint      `gorm:"not null;index:uq_note_user_date,priority:1" json:"userId"`
    WorkDate  time.Time `gorm:"type:date;not null;index:uq_note_user_date,priority:2" json:"workDate"`
    Content   string    `gorm:"type:text;not null" json:"content"`
    CreatedAt time.Time `json:"createdAt"`
    UpdatedAt time.Time `json:"updatedAt"`
}

func (DailyNote) TableName() string { return "daily_notes" }

