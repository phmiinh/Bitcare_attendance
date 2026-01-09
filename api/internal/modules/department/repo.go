package department

import (
	"context"

	"gorm.io/gorm"
)

type Repo struct{ db *gorm.DB }

func NewRepo(db *gorm.DB) *Repo { return &Repo{db: db} }

func (r *Repo) List(ctx context.Context) ([]Department, error) {
	var rows []Department
	if err := r.db.WithContext(ctx).Order("name ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *Repo) GetByID(ctx context.Context, id uint) (*Department, error) {
	var d Department
	if err := r.db.WithContext(ctx).First(&d, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repo) Create(ctx context.Context, d *Department) error {
	return r.db.WithContext(ctx).Create(d).Error
}

func (r *Repo) Update(ctx context.Context, d *Department) error {
	return r.db.WithContext(ctx).Save(d).Error
}

func (r *Repo) Delete(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Delete(&Department{}, id).Error
}

















