package middleware

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"
)

func Recover(log *zap.Logger) fiber.Handler {
	return func(c *fiber.Ctx) (err error) {
		defer func() {
			if r := recover(); r != nil {
				log.Error("panic recovered", zap.Any("panic", r))
				err = fiber.ErrInternalServerError
			}
		}()
		return c.Next()
	}
}

















