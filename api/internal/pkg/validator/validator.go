package validator

import (
	"github.com/go-playground/validator/v10"
)

type Validator struct {
	v *validator.Validate
}

func New() *Validator {
	return &Validator{v: validator.New()}
}

func (vv *Validator) Validate(i any) error {
	return vv.v.Struct(i)
}

type FieldError struct {
	Field string `json:"field"`
	Tag   string `json:"tag"`
	Param string `json:"param,omitempty"`
}

func AsFieldErrors(err error) []FieldError {
	ves, ok := err.(validator.ValidationErrors)
	if !ok {
		return nil
	}

	out := make([]FieldError, 0, len(ves))
	for _, fe := range ves {
		out = append(out, FieldError{
			Field: fe.Field(),
			Tag:   fe.Tag(),
			Param: fe.Param(),
		})
	}
	return out
}

















