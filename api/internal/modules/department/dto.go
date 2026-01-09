package department

import "time"

type CreateDepartmentReq struct {
	Name string  `json:"name" validate:"required,min=2,max=120"`
	Code *string `json:"code" validate:"omitempty,max=50"`
}

type UpdateDepartmentReq struct {
	Name *string `json:"name" validate:"omitempty,min=2,max=120"`
	Code *string `json:"code" validate:"omitempty,max=50"`
}

type DepartmentRes struct {
	ID        uint      `json:"id"`
	Name      string    `json:"name"`
	Code      *string   `json:"code"`
	CreatedAt time.Time `json:"createdAt"`
}

func ToRes(d *Department) DepartmentRes {
	return DepartmentRes{ID: d.ID, Name: d.Name, Code: d.Code, CreatedAt: d.CreatedAt}
}

















