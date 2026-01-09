package department

import (
	"context"
	"time"

	"time-attendance-be/internal/pkg/validator"
)

type Service struct {
	repo *Repo
	v    *validator.Validator
}

func NewService(repo *Repo) *Service {
	return &Service{repo: repo, v: validator.New()}
}

func (s *Service) List(ctx context.Context) ([]Department, error) {
	return s.repo.List(ctx)
}

func (s *Service) Create(ctx context.Context, req CreateDepartmentReq) (*Department, error) {
	if err := s.v.Validate(req); err != nil {
		return nil, err
	}
	d := &Department{Name: req.Name, Code: req.Code, CreatedAt: time.Now(), UpdatedAt: time.Now()}
	if err := s.repo.Create(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *Service) Update(ctx context.Context, id uint, req UpdateDepartmentReq) (*Department, error) {
	if err := s.v.Validate(req); err != nil {
		return nil, err
	}
	d, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if req.Name != nil {
		d.Name = *req.Name
	}
	if req.Code != nil {
		d.Code = req.Code
	}
	d.UpdatedAt = time.Now()
	if err := s.repo.Update(ctx, d); err != nil {
		return nil, err
	}
	return d, nil
}

func (s *Service) Delete(ctx context.Context, id uint) error {
	return s.repo.Delete(ctx, id)
}

















