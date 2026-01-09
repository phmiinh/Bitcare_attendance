package user

import (
	"context"
	"time"

	"time-attendance-be/internal/config"
	"time-attendance-be/internal/modules/department"
	"time-attendance-be/internal/pkg/response"
	"time-attendance-be/internal/pkg/security"
	"time-attendance-be/internal/pkg/validator"

	"gorm.io/gorm"
)

type Service struct {
	cfg      *config.Config
	repo     *Repo
	deptRepo *department.Repo
	v        *validator.Validator
}

func NewService(cfg *config.Config, repo *Repo, deptRepo *department.Repo) *Service {
	return &Service{cfg: cfg, repo: repo, deptRepo: deptRepo, v: validator.New()}
}

func (s *Service) GetMe(ctx context.Context, userID uint) (*User, error) {
	return s.repo.GetByID(ctx, userID)
}

func (s *Service) List(ctx context.Context, query string, departmentID *uint, page, limit int) ([]User, int64, error) {
	return s.repo.List(ctx, query, departmentID, page, limit)
}

func (s *Service) Create(ctx context.Context, req UserCreateInput) (*User, error) {
	if err := s.v.Validate(req); err != nil {
		return nil, err
	}

	if _, err := s.repo.GetByEmail(ctx, req.Email); err != gorm.ErrRecordNotFound {
		return nil, response.Conflict("Email already exists")
	}

	if req.DepartmentID != nil {
		if _, err := s.deptRepo.GetByID(ctx, *req.DepartmentID); err != nil {
			return nil, response.Validation("Department not found", nil)
		}
	}

	hash, err := security.HashPassword(req.Password)
	if err != nil {
		return nil, response.Internal(err)
	}

	role := "user"
	if req.Role != "" {
		role = req.Role
	}
	status := "active"
	if req.Status != "" {
		status = req.Status
	}

	var birthday *time.Time
	if req.Birthday != nil && req.Birthday.Time != nil {
		birthday = req.Birthday.Time
	}

	u := &User{
		Name:         req.Name,
		Email:        req.Email,
		PasswordHash: hash,
		Role:         role,
		Status:       status,
		DepartmentID: req.DepartmentID,
		Birthday:     birthday,
		PaidLeave:    0.0, // Mặc định 0 ngày phép khi tạo mới
		CreatedAt:    time.Now().In(s.cfg.TimeLocation()),
		UpdatedAt:    time.Now().In(s.cfg.TimeLocation()),
	}

	if err := s.repo.Create(ctx, u); err != nil {
		return nil, response.Internal(err)
	}
	return s.repo.GetByID(ctx, u.ID)
}

func (s *Service) Update(ctx context.Context, id uint, req UserUpdateInput) (*User, error) {
	if err := s.v.Validate(req); err != nil {
		return nil, err
	}

	u, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, response.NotFound("User not found")
	}

	if req.Email != nil && *req.Email != u.Email {
		if _, err := s.repo.GetByEmail(ctx, *req.Email); err != gorm.ErrRecordNotFound {
			return nil, response.Conflict("Email already exists")
		}
		u.Email = *req.Email
	}

	if req.Password != nil {
		hash, err := security.HashPassword(*req.Password)
		if err != nil {
			return nil, response.Internal(err)
		}
		u.PasswordHash = hash
	}

	if req.Name != nil {
		u.Name = *req.Name
	}
	if req.Role != nil {
		u.Role = *req.Role
	}
	if req.Status != nil {
		u.Status = *req.Status
	}
	if req.DepartmentID != nil {
		if _, err := s.deptRepo.GetByID(ctx, *req.DepartmentID); err != nil {
			return nil, response.Validation("Department not found", nil)
		}
		u.DepartmentID = req.DepartmentID
	}
	if req.Birthday != nil {
		if req.Birthday.Time != nil {
			u.Birthday = req.Birthday.Time
		} else {
			u.Birthday = nil
		}
	}

	u.UpdatedAt = time.Now().In(s.cfg.TimeLocation())
	if err := s.repo.Update(ctx, u); err != nil {
		return nil, response.Internal(err)
	}
	return s.repo.GetByID(ctx, u.ID)
}

func (s *Service) Delete(ctx context.Context, id uint) error {
	return s.repo.Delete(ctx, id)
}
