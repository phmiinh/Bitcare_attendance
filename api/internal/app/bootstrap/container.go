package bootstrap

import (
	"context"

	"time-attendance-be/internal/config"
	"time-attendance-be/internal/middleware"
	"time-attendance-be/internal/modules/attendance"
	"time-attendance-be/internal/modules/audit"
	"time-attendance-be/internal/modules/auth"
	"time-attendance-be/internal/modules/department"
	"time-attendance-be/internal/modules/leave"
	"time-attendance-be/internal/modules/notes"
	"time-attendance-be/internal/modules/stats"
	"time-attendance-be/internal/modules/user"
	"time-attendance-be/internal/modules/workcalendar"
	"time-attendance-be/internal/pkg/clock"
	platformauth "time-attendance-be/internal/platform/auth"
	"time-attendance-be/internal/platform/db"
	"time-attendance-be/internal/platform/logger"

	"go.uber.org/zap"
	"gorm.io/gorm"
)

type Container struct {
	Cfg *config.Config

	Logger *zap.Logger
	DB     *gorm.DB
	Clock  clock.Clock

	JWT *platformauth.Manager

	// Middlewares
	AuthRequired  *middleware.AuthRequired
	AdminRequired *middleware.AdminRequired

	// Modules
	Auth        *auth.Module
	Users       *user.Module
	Departments *department.Module
	Attendance  *attendance.Module
	Notes       *notes.Module
	Stats       *stats.Module
	Leave       *leave.Module
	WorkCalendar *workcalendar.Module
	Audit       *audit.Module
}

func NewContainer(cfg *config.Config) *Container {
	log := logger.New(cfg)
	clk := clock.New(cfg.TimeLocation())
	gormDB := db.NewMySQL(cfg, log)

	jwtMgr := platformauth.NewManager(cfg)

	// Repositories
	userRepo := user.NewRepo(gormDB)
	deptRepo := department.NewRepo(gormDB)
	attRepo := attendance.NewRepo(gormDB)
	noteRepo := notes.NewRepo(gormDB)
	leaveRepo := leave.NewRepo(gormDB)
	workCalRepo := workcalendar.NewRepo(gormDB)
	auditRepo := audit.NewRepo(gormDB)

	// Services
	authSvc := auth.NewService(cfg, userRepo, jwtMgr)
	userSvc := user.NewService(cfg, userRepo, deptRepo)
	deptSvc := department.NewService(deptRepo)
	attSvc := attendance.NewService(cfg, attRepo, clk)
	attSvc.SetUserRepo(userRepo) // Set userRepo for attendance service
	noteSvc := notes.NewService(cfg, noteRepo, clk)

	// Create work calendar adapter first
	workCalAdapter := workcalendar.NewAdapter(workCalRepo)

	// Create leave service with the work calendar adapter
	leaveSvc := leave.NewService(cfg, userRepo, leaveRepo, log)
	leaveSvc.SetAttendanceRepo(attRepo) // Set attendance repo for auto leave detection
	leaveSvc.SetWorkCalendarRepo(workCalAdapter) // Use adapter instead of direct repo

	// Create leave module
	leaveMod := leave.NewModule(leaveSvc)

	// Ensure work calendar for current year exists
	_ = workCalRepo.EnsureYear(context.Background(), clock.New(cfg.TimeLocation()).Now().Year())

	// Audit service
	auditSvc := audit.NewService(auditRepo)

	// Modules
	authMod := auth.NewModule(authSvc, cfg)
	usersMod := user.NewModule(userSvc, auditSvc)
	deptMod := department.NewModule(deptSvc)
	attMod := attendance.NewModule(attSvc)
	noteMod := notes.NewModule(noteSvc)
	statsMod := stats.NewModule(cfg, gormDB, clk)
	workCalMod := workcalendar.NewModule(workCalRepo, leaveSvc, log, auditSvc)
	auditMod := audit.NewModule(auditRepo)

	// Middlewares
	authRequired := middleware.NewAuthRequired(cfg, jwtMgr, userRepo)
	adminRequired := middleware.NewAdminRequired()

	return &Container{
		Cfg:           cfg,
		Logger:        log,
		DB:            gormDB,
		Clock:         clk,
		JWT:           jwtMgr,
		AuthRequired:  authRequired,
		AdminRequired: adminRequired,
		Auth:          authMod,
		Users:         usersMod,
		Departments:   deptMod,
		Attendance:    attMod,
		Notes:         noteMod,
		Stats:         statsMod,
		Leave:         leaveMod,
		WorkCalendar:  workCalMod,
		Audit:         auditMod,
	}
}
