package user

import (
	"strconv"

	"time-attendance-be/internal/authx"
	"time-attendance-be/internal/modules/audit"
	"time-attendance-be/internal/pkg/pagination"
	"time-attendance-be/internal/pkg/response"
	"time-attendance-be/internal/pkg/validator"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type Handler struct {
	svc        *Service
	auditSvc   *audit.Service
}

func NewHandler(svc *Service, auditSvc *audit.Service) *Handler {
	return &Handler{svc: svc, auditSvc: auditSvc}
}

// GET /api/v1/me
func (h *Handler) Me(c *fiber.Ctx) error {
	a := authx.GetUser(c)
	if a == nil {
		return response.Unauthorized("Unauthorized")
	}
	me, err := h.svc.GetMe(c.Context(), a.ID)
	if err != nil {
		return response.Internal(err)
	}
	return response.OK(c, ToMeResponse(me))
}

// GET /api/v1/admin/users
func (h *Handler) AdminList(c *fiber.Ctx) error {
	p := pagination.Parse(c, 1, 10, 100)
	_, limit := pagination.OffsetLimit(p)

	query := c.Query("query")
	var deptID *uint
	if v := c.Query("departmentId"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			u := uint(n)
			deptID = &u
		}
	}

	rows, total, err := h.svc.List(c.Context(), query, deptID, p.Page, limit)
	if err != nil {
		return response.Internal(err)
	}

	items := make([]UserResponse, 0, len(rows))
	for i := range rows {
		u := rows[i]
		items = append(items, ToUserResponse(&u))
	}

	return response.OK(c, AdminUsersListResponse{
		Page:  p.Page,
		Limit: limit,
		Total: total,
		Items: items,
	})
}

// POST /api/v1/admin/users
func (h *Handler) AdminCreate(c *fiber.Ctx) error {
	adminUser := authx.GetUser(c)
	if adminUser == nil {
		return response.Unauthorized("Unauthorized")
	}

	var req UserCreateInput
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid body", nil)
	}
	created, err := h.svc.Create(c.Context(), req)
	if err != nil {
		return mapErr(err)
	}

	// Log audit
	if h.auditSvc != nil {
		_ = h.auditSvc.LogAdminAction(
			c.Context(),
			adminUser.ID,
			"CREATE",
			"user",
			strconv.FormatUint(uint64(created.ID), 10),
			nil, // before
			ToUserResponse(created),
			"",
		)
	}

	return response.Created(c, ToUserResponse(created))
}

// GET /api/v1/admin/users/:id
func (h *Handler) AdminGet(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	u, err := h.svc.repo.GetByID(c.Context(), uint(id))
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.NotFound("User not found")
		}
		return response.Internal(err)
	}
	return response.OK(c, ToUserResponse(u))
}

// PATCH /api/v1/admin/users/:id
func (h *Handler) AdminUpdate(c *fiber.Ctx) error {
	adminUser := authx.GetUser(c)
	if adminUser == nil {
		return response.Unauthorized("Unauthorized")
	}

	id, _ := strconv.Atoi(c.Params("id"))
	
	// Get before state
	before, err := h.svc.repo.GetByID(c.Context(), uint(id))
	if err != nil && err != gorm.ErrRecordNotFound {
		return response.Internal(err)
	}
	var beforeResp *UserResponse
	if before != nil {
		resp := ToUserResponse(before)
		beforeResp = &resp
	}

	var req UserUpdateInput
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid body", nil)
	}
	u, err := h.svc.Update(c.Context(), uint(id), req)
	if err != nil {
		return mapErr(err)
	}

	// Log audit
	if h.auditSvc != nil {
		_ = h.auditSvc.LogAdminAction(
			c.Context(),
			adminUser.ID,
			"UPDATE",
			"user",
			strconv.FormatUint(uint64(id), 10),
			beforeResp,
			ToUserResponse(u),
			"",
		)
	}

	return response.OK(c, ToUserResponse(u))
}

// DELETE /api/v1/admin/users/:id
func (h *Handler) AdminDelete(c *fiber.Ctx) error {
	adminUser := authx.GetUser(c)
	if adminUser == nil {
		return response.Unauthorized("Unauthorized")
	}

	id, _ := strconv.Atoi(c.Params("id"))
	
	// Get before state
	before, err := h.svc.repo.GetByID(c.Context(), uint(id))
	if err != nil && err != gorm.ErrRecordNotFound {
		return response.Internal(err)
	}
	var beforeResp *UserResponse
	if before != nil {
		resp := ToUserResponse(before)
		beforeResp = &resp
	}

	if err := h.svc.Delete(c.Context(), uint(id)); err != nil {
		return response.Internal(err)
	}

	// Log audit
	if h.auditSvc != nil && beforeResp != nil {
		_ = h.auditSvc.LogAdminAction(
			c.Context(),
			adminUser.ID,
			"DELETE",
			"user",
			strconv.FormatUint(uint64(id), 10),
			beforeResp,
			nil, // after
			"",
		)
	}

	return response.OK(c, true)
}

func mapErr(err error) error {
	if fes := validator.AsFieldErrors(err); fes != nil {
		return response.Validation("Validation error", fes)
	}
	return err
}
