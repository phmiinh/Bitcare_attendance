package pagination

import (
	"math"
	"strconv"

	"github.com/gofiber/fiber/v2"
)

type Params struct {
	Page  int
	Limit int
}

func Parse(c *fiber.Ctx, defaultPage, defaultLimit, maxLimit int) Params {
	page := defaultPage
	limit := defaultLimit

	if v := c.Query("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			page = n
		}
	}
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}

	if maxLimit > 0 && limit > maxLimit {
		limit = maxLimit
	}

	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = defaultLimit
	}

	return Params{Page: page, Limit: limit}
}

func OffsetLimit(p Params) (offset int, limit int) {
	offset = (p.Page - 1) * p.Limit
	if offset < 0 {
		offset = 0
	}
	return offset, p.Limit
}

func TotalPages(total, limit int) int {
	if limit <= 0 {
		return 0
	}
	return int(math.Ceil(float64(total) / float64(limit)))
}

















