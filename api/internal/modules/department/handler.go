package department

import (
	"strconv"

	"time-attendance-be/internal/pkg/response"
	"time-attendance-be/internal/pkg/validator"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c *fiber.Ctx) error {
	rows, err := h.svc.List(c.Context())
	if err != nil {
		return response.Internal(err)
	}
	items := make([]DepartmentRes, 0, len(rows))
	for i := range rows {
		d := rows[i]
		items = append(items, ToRes(&d))
	}
	return response.OK(c, items)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreateDepartmentReq
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid body", nil)
	}
	d, err := h.svc.Create(c.Context(), req)
	if err != nil {
		return mapErr(err)
	}
	return response.Created(c, ToRes(d))
}

func (h *Handler) Update(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	var req UpdateDepartmentReq
	if err := c.BodyParser(&req); err != nil {
		return response.Validation("Invalid body", nil)
	}
	d, err := h.svc.Update(c.Context(), uint(id), req)
	if err != nil {
		return mapErr(err)
	}
	return response.OK(c, ToRes(d))
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	id, _ := strconv.Atoi(c.Params("id"))
	if err := h.svc.Delete(c.Context(), uint(id)); err != nil {
		if err == gorm.ErrRecordNotFound {
			return response.NotFound("Not found")
		}
		return response.Internal(err)
	}
	return response.OK(c, true)
}

func mapErr(err error) error {
	if verr := validatorErr(err); verr != nil {
		return verr
	}
	if err == gorm.ErrRecordNotFound {
		return response.NotFound("Not found")
	}
	return response.Internal(err)
}

func validatorErr(err error) error {
	// reuse validator wrapper for details
	if fes := validator.AsFieldErrors(err); fes != nil {
		return response.Validation("Validation error", fes)
	}
	return nil
}

