package response

import (
	"net/http"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

type ErrorBody struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details any    `json:"details,omitempty"`
	} `json:"error"`
}

type DataBody[T any] struct {
	Data T `json:"data"`
}

func OK[T any](c *fiber.Ctx, data T) error {
	return c.Status(http.StatusOK).JSON(DataBody[T]{Data: data})
}

func Created[T any](c *fiber.Ctx, data T) error {
	return c.Status(http.StatusCreated).JSON(DataBody[T]{Data: data})
}

func FiberErrorHandler(log *zap.Logger) fiber.ErrorHandler {
	return func(c *fiber.Ctx, err error) error {
		if err == nil {
			return nil
		}

		if fe, ok := err.(*fiber.Error); ok {
			// Convert fiber.Error -> AppError-ish
			code := CodeInternal
			status := fe.Code
			switch status {
			case http.StatusBadRequest:
				code = CodeValidationError
			case http.StatusUnauthorized:
				code = CodeUnauthorized
			case http.StatusForbidden:
				code = CodeForbidden
			case http.StatusNotFound:
				code = CodeNotFound
			case http.StatusConflict:
				code = CodeConflict
			default:
				code = CodeInternal
			}

			var body ErrorBody
			body.Error.Code = code
			body.Error.Message = fe.Message
			return c.Status(status).JSON(body)
		}

		if ae, ok := IsAppError(err); ok {
			var body ErrorBody
			body.Error.Code = ae.Code
			body.Error.Message = ae.Message
			body.Error.Details = ae.Details
			return c.Status(ae.HTTPStatus).JSON(body)
		}

		log.Error("unhandled error", zap.Error(err))
		var body ErrorBody
		body.Error.Code = CodeInternal
		body.Error.Message = "Internal server error"
		return c.Status(http.StatusInternalServerError).JSON(body)
	}
}

















