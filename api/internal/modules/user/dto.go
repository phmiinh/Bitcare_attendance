package user

import (
	"encoding/json"
	"time"
)

// BirthdayDate is a custom type to parse birthday from "YYYY-MM-DD" string format
type BirthdayDate struct {
	*time.Time
}

// UnmarshalJSON implements json.Unmarshaler for BirthdayDate
func (bd *BirthdayDate) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	if s == "" || s == "null" {
		bd.Time = nil
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return err
	}
	bd.Time = &t
	return nil
}

// MarshalJSON implements json.Marshaler for BirthdayDate
func (bd BirthdayDate) MarshalJSON() ([]byte, error) {
	if bd.Time == nil {
		return []byte("null"), nil
	}
	return json.Marshal(bd.Time.Format("2006-01-02"))
}

// UserCreateInput represents the input for creating a user.
type UserCreateInput struct {
	Name         string        `json:"name" validate:"required,min=2,max=120"`
	Email        string        `json:"email" validate:"required,email,max=190"`
	Password     string        `json:"password" validate:"required,min=8,max=100"`
	Role         string        `json:"role" validate:"omitempty,oneof=user admin"`
	Status       string        `json:"status" validate:"omitempty,oneof=active disabled"`
	DepartmentID *uint         `json:"departmentId" validate:"omitempty"`
	Birthday     *BirthdayDate `json:"birthday" validate:"omitempty"` // Format: "2006-01-02"
}

// UserUpdateInput represents the input for updating a user.
type UserUpdateInput struct {
	Name         *string       `json:"name" validate:"omitempty,min=2,max=120"`
	Email        *string       `json:"email" validate:"omitempty,email,max=190"`
	Password     *string       `json:"password" validate:"omitempty,min=8,max=100"`
	Role         *string       `json:"role" validate:"omitempty,oneof=user admin"`
	Status       *string       `json:"status" validate:"omitempty,oneof=active disabled"`
	DepartmentID *uint         `json:"departmentId" validate:"omitempty"`
	Birthday     *BirthdayDate `json:"birthday" validate:"omitempty"` // Format: "2006-01-02"
}

// UserResponse represents the user data sent to clients.
type UserResponse struct {
	ID             uint       `json:"id"`
	Name           string     `json:"name"`
	Email          string     `json:"email"`
	Role           string     `json:"role"`
	Status         string     `json:"status"`
	DepartmentID   *uint      `json:"departmentId"`
	DepartmentName *string    `json:"departmentName"`
	Birthday       *time.Time `json:"birthday"`  // Format: "2006-01-02"
	PaidLeave      float64    `json:"paidLeave"` // Số ngày nghỉ phép
	CreatedAt      time.Time  `json:"createdAt"`
}

func ToUserResponse(u *User) UserResponse {
	var deptName *string
	if u.Department != nil {
		deptName = &u.Department.Name
	}
	return UserResponse{
		ID:             u.ID,
		Name:           u.Name,
		Email:          u.Email,
		Role:           u.Role,
		Status:         u.Status,
		DepartmentID:   u.DepartmentID,
		DepartmentName: deptName,
		Birthday:       u.Birthday,
		PaidLeave:      u.PaidLeave,
		CreatedAt:      u.CreatedAt,
	}
}

// MeResponse matches GET /api/v1/me response.
type MeResponse struct {
	ID             uint       `json:"id"`
	Name           string     `json:"name"`
	Email          string     `json:"email"`
	Role           string     `json:"role"`
	Status         string     `json:"status"`
	DepartmentID   *uint      `json:"departmentId"`
	DepartmentName *string    `json:"departmentName"`
	Birthday       *time.Time `json:"birthday"`  // Format: "2006-01-02"
	PaidLeave      float64    `json:"paidLeave"` // Số ngày nghỉ phép
}

func ToMeResponse(u *User) MeResponse {
	var deptName *string
	if u.Department != nil {
		deptName = &u.Department.Name
	}
	return MeResponse{
		ID:             u.ID,
		Name:           u.Name,
		Email:          u.Email,
		Role:           u.Role,
		Status:         u.Status,
		DepartmentID:   u.DepartmentID,
		DepartmentName: deptName,
		Birthday:       u.Birthday,
		PaidLeave:      u.PaidLeave,
	}
}

// AdminUsersListResponse matches GET /api/v1/admin/users response.
type AdminUsersListResponse struct {
	Page  int            `json:"page"`
	Limit int            `json:"limit"`
	Total int64          `json:"total"`
	Items []UserResponse `json:"items"`
}
