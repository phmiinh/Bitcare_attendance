package response

import (
	"errors"
	"net/http"
)

type AppError struct {
	HTTPStatus int
	Code       string
	Message    string
	Details    any
	Err        error
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}
	return e.Message
}

func (e *AppError) Unwrap() error { return e.Err }

func New(code, message string, httpStatus int) *AppError {
	return &AppError{HTTPStatus: httpStatus, Code: code, Message: message}
}

func Wrap(err error, code, message string, httpStatus int) *AppError {
	return &AppError{HTTPStatus: httpStatus, Code: code, Message: message, Err: err}
}

// Standard error codes.
const (
	CodeValidationError = "validation_error"
	CodeUnauthorized    = "unauthorized"
	CodeForbidden       = "forbidden"
	CodeNotFound        = "not_found"
	CodeConflict        = "conflict"
	CodeInternal        = "internal_error"
)

func Validation(message string, details any) *AppError {
	e := New(CodeValidationError, message, http.StatusBadRequest)
	e.Details = details
	return e
}

func Unauthorized(message string) *AppError {
	return New(CodeUnauthorized, message, http.StatusUnauthorized)
}

func Forbidden(message string) *AppError {
	return New(CodeForbidden, message, http.StatusForbidden)
}

func NotFound(message string) *AppError {
	return New(CodeNotFound, message, http.StatusNotFound)
}

func Conflict(message string) *AppError {
	return New(CodeConflict, message, http.StatusConflict)
}

func Internal(err error) *AppError {
	return Wrap(err, CodeInternal, "Internal server error", http.StatusInternalServerError)
}

func IsAppError(err error) (*AppError, bool) {
	var ae *AppError
	if errors.As(err, &ae) {
		return ae, true
	}
	return nil, false
}

















