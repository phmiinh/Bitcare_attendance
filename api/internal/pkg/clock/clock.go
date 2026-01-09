package clock

import "time"

// Clock abstracts time for testability.
type Clock interface {
	Now() time.Time
	Location() *time.Location
}

type realClock struct {
	loc *time.Location
}

func New(loc *time.Location) Clock {
	if loc == nil {
		loc = time.UTC
	}
	return &realClock{loc: loc}
}

func (c *realClock) Now() time.Time {
	return time.Now().In(c.loc)
}

func (c *realClock) Location() *time.Location {
	return c.loc
}

// FixedClock is useful for unit tests.
type FixedClock struct {
	T   time.Time
	Loc *time.Location
}

func (f FixedClock) Now() time.Time {
	loc := f.Loc
	if loc == nil {
		loc = time.UTC
	}
	return f.T.In(loc)
}

func (f FixedClock) Location() *time.Location {
	if f.Loc == nil {
		return time.UTC
	}
	return f.Loc
}

















