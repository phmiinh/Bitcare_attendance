package user

import (
	"context"

	"gorm.io/gorm"
)

type Repo struct{ db *gorm.DB }

func NewRepo(db *gorm.DB) *Repo { return &Repo{db: db} }

func (r *Repo) GetByID(ctx context.Context, id uint) (*User, error) {
	var u User
	if err := r.db.WithContext(ctx).Preload("Department").First(&u, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repo) GetByEmail(ctx context.Context, email string) (*User, error) {
	var u User
	if err := r.db.WithContext(ctx).Preload("Department").First(&u, "email = ?", email).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func (r *Repo) Create(ctx context.Context, u *User) error {
	return r.db.WithContext(ctx).Create(u).Error
}

func (r *Repo) Update(ctx context.Context, u *User) error {
	// Không cho GORM tự động save association Department,
	// nếu không nó có thể ghi đè lại department_id theo Department cũ.
	u.Department = nil
	return r.db.WithContext(ctx).
		Session(&gorm.Session{FullSaveAssociations: false}).
		Save(u).Error
}

func (r *Repo) Delete(ctx context.Context, id uint) error {
	// Use Unscoped().Delete() to perform hard delete (permanently remove from database)
	return r.db.WithContext(ctx).Unscoped().Delete(&User{}, id).Error
}

func (r *Repo) List(ctx context.Context, query string, departmentID *uint, page, limit int) ([]User, int64, error) {
	q := r.db.WithContext(ctx).Model(&User{}).Preload("Department")
	if query != "" {
		like := "%" + query + "%"
		q = q.Where("name LIKE ? OR email LIKE ?", like, like)
	}
	if departmentID != nil {
		q = q.Where("department_id = ?", *departmentID)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit
	if offset < 0 {
		offset = 0
	}

	var rows []User
	if err := q.Order("id DESC").Offset(offset).Limit(limit).Find(&rows).Error; err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

// GetAllActiveUsers returns all active users
func (r *Repo) GetAllActiveUsers(ctx context.Context) ([]User, error) {
	var users []User
	if err := r.db.WithContext(ctx).Where("status = ?", "active").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

// IncrementPaidLeave increments paid leave for a user
func (r *Repo) IncrementPaidLeave(ctx context.Context, userID uint, days float64) error {
	return r.db.WithContext(ctx).Model(&User{}).
		Where("id = ?", userID).
		Update("paid_leave", gorm.Expr("paid_leave + ?", days)).Error
}

// BatchIncrementPaidLeave increments paid leave for multiple users
func (r *Repo) BatchIncrementPaidLeave(ctx context.Context, userIDs []uint, days float64) error {
	if len(userIDs) == 0 {
		return nil
	}
	return r.db.WithContext(ctx).Model(&User{}).
		Where("id IN ?", userIDs).
		Update("paid_leave", gorm.Expr("paid_leave + ?", days)).Error
}

// BatchDecrementPaidLeave decrements paid leave for multiple users (same amount for all)
func (r *Repo) BatchDecrementPaidLeave(ctx context.Context, userIDs []uint, days float64) error {
	if len(userIDs) == 0 {
		return nil
	}
	// Ensure paid_leave doesn't go below 0
	return r.db.WithContext(ctx).Model(&User{}).
		Where("id IN ?", userIDs).
		Update("paid_leave", gorm.Expr("GREATEST(paid_leave - ?, 0)", days)).Error
}

// DecrementPaidLeave decrements paid leave for a single user
func (r *Repo) DecrementPaidLeave(ctx context.Context, userID uint, days float64) error {
	return r.db.WithContext(ctx).Model(&User{}).
		Where("id = ?", userID).
		Update("paid_leave", gorm.Expr("GREATEST(paid_leave - ?, 0)", days)).Error
}
