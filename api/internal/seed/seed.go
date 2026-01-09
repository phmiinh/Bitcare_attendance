package seed

import (
	"time-attendance-be/internal/config"
	"time-attendance-be/internal/modules/department"
	"time-attendance-be/internal/modules/user"
	"time-attendance-be/internal/pkg/security"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

func Seed(db *gorm.DB, cfg *config.Config, log *zap.Logger) {
	// Check if admin exists
	var count int64
	db.Model(&user.User{}).Where("email = ?", cfg.DefaultAdminEmail).Count(&count)
	if count > 0 {
		log.Info("admin user already exists, skipping seed")
		return
	}

	log.Info("seeding database with initial data")

	tx := db.Begin()

	// Create Departments (skip if already exist)
	deptNames := []struct {
		Name string
		Code *string
	}{
		{"Engineering", strPtr("ENG")},
		{"Product", strPtr("PROD")},
		{"Design", strPtr("DES")},
	}
	
	var depts []department.Department
	for _, d := range deptNames {
		var dept department.Department
		result := tx.Where("name = ?", d.Name).First(&dept)
		if result.Error == gorm.ErrRecordNotFound {
			// Department doesn't exist, create it
			newDept := department.Department{Name: d.Name, Code: d.Code}
			if err := tx.Create(&newDept).Error; err != nil {
				tx.Rollback()
				log.Fatal("failed to seed department", zap.String("name", d.Name), zap.Error(err))
			}
			depts = append(depts, newDept)
		} else if result.Error != nil {
			tx.Rollback()
			log.Fatal("failed to check department", zap.String("name", d.Name), zap.Error(result.Error))
		} else {
			// Department exists, use it
			depts = append(depts, dept)
		}
	}
	
	// Ensure we have at least 3 departments for seed data
	if len(depts) < 3 {
		tx.Rollback()
		log.Fatal("failed to seed departments: not enough departments created")
	}

	// Create Admin User
	adminHash, _ := security.HashPassword(cfg.DefaultAdminPassword)
	admin := user.User{
		Name:         "Admin User",
		Email:        cfg.DefaultAdminEmail,
		PasswordHash: adminHash,
		Role:         "admin",
		Status:       "active",
		DepartmentID: &depts[0].ID,
	}
	if err := tx.Create(&admin).Error; err != nil {
		tx.Rollback()
		log.Fatal("failed to seed admin user", zap.Error(err))
	}

	// Create Demo Users
	userHash, _ := security.HashPassword("User@12345")
	users := []user.User{
		{
			Name:         "Alice (Product)",
			Email:        "alice@local.test",
			PasswordHash: userHash,
			Role:         "user",
			Status:       "active",
			DepartmentID: &depts[1].ID,
		},
		{
			Name:         "Bob (Design)",
			Email:        "bob@local.test",
			PasswordHash: userHash,
			Role:         "user",
			Status:       "active",
			DepartmentID: &depts[2].ID,
		},
	}
	if err := tx.Create(&users).Error; err != nil {
		tx.Rollback()
		log.Fatal("failed to seed demo users", zap.Error(err))
	}

	if err := tx.Commit().Error; err != nil {
		log.Fatal("failed to commit seed transaction", zap.Error(err))
	}

	log.Info("database seeding completed")
}

func strPtr(s string) *string { return &s }
