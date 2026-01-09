package attendance

import "time"

const (
	// Working window
	WorkStart  = "08:00" // check-in allowed from 8:00 AM
	CheckInEnd = "18:00" // after this, check-in is NOT allowed
	WorkEndCap = "19:00" // checkout allowed until 19:00
	
	// Actual working hours for calculating worked minutes
	WorkStartCalc  = "08:30" // worked minutes calculation starts from 8:30 AM
	WorkEndCalc    = "18:00" // worked minutes calculation ends at 6:00 PM

	// Half-day rules
	MorningCutOff   = "09:30" // check-in after this => no morning credit
	AfternoonCutOff = "15:30" // check-out before this => no afternoon credit

	// Lunch break
	LunchStart = "12:00"
	LunchEnd   = "13:30"
)

// combineDateAndHM returns time on same date of given time t but hour:minute = hm (HH:MM)
func combineDateAndHM(t time.Time, hm string) time.Time {
	y, m, d := t.Date()
	h, _ := time.Parse("15:04", hm)
	return time.Date(y, m, d, h.Hour(), h.Minute(), 0, 0, t.Location())
}

// IsCheckInAllowed enforces: cannot check-in outside working hours.
// Checkout is still allowed.
func IsCheckInAllowed(now time.Time) bool {
	start := combineDateAndHM(now, WorkStart)
	end := combineDateAndHM(now, CheckInEnd)
	return !now.Before(start) && !now.After(end)
}

// ComputeDayUnit (HALF-DAY MODEL)
// - Morning (0.5): check-in <= 09:30
// - Afternoon (0.5): check-out >= 15:30 AND check-in <= 15:30
// - If check-in after 15:30: no afternoon credit (even if checkout >= 15:30)
// - If no check-out yet, afternoon credit = 0
func ComputeDayUnit(checkIn, checkOut *time.Time, loc *time.Location) (dayUnit float32) {
	if checkIn == nil {
		return 0.0
	}

	ci := checkIn.In(loc)
	morningOK := !ci.After(combineDateAndHM(ci, MorningCutOff))
	
	// Check if check-in is after 15:30 (afternoon cutoff)
	// If check-in after 15:30, morning is already missed, so no morning credit
	// And even if checkout >= 15:30, no afternoon credit because check-in was too late
	checkInAfterAfternoonCutoff := ci.After(combineDateAndHM(ci, AfternoonCutOff))

	afternoonOK := false
	if checkOut != nil && !checkInAfterAfternoonCutoff {
		co := checkOut.In(loc)
		// checkout on/after 15:30 qualifies afternoon
		// BUT only if check-in was before/at 15:30
		afternoonOK = !co.Before(combineDateAndHM(co, AfternoonCutOff))
	}

	switch {
	case morningOK && afternoonOK:
		return 1.0
	case morningOK || afternoonOK:
		return 0.5
	default:
		return 0.0
	}
}

// overlapMinutes returns the number of minutes in the overlap between [aStart, aEnd) and [bStart, bEnd)
func overlapMinutes(aStart, aEnd, bStart, bEnd time.Time) int {
	// no overlap
	if !aEnd.After(bStart) || !bEnd.After(aStart) {
		return 0
	}

	start := aStart
	if bStart.After(start) {
		start = bStart
	}
	end := aEnd
	if bEnd.Before(end) {
		end = bEnd
	}
	if !end.After(start) {
		return 0
	}
	return int(end.Sub(start).Minutes())
}

// ComputeWorkedMinutes
// - Only count time within working hours: 8:30-18:00 (excluding lunch break 12:00-13:30)
// - If checkIn is before 8:30, start counting from 8:30
// - If checkOut is after 18:00, stop counting at 18:00
// - Subtract the ACTUAL overlap with lunch break (12:00-13:30)
// - If working full day (checkIn <= 8:30 and checkOut >= 18:00), return exactly 8 hours (480 minutes)
func ComputeWorkedMinutes(checkIn, checkOut time.Time, loc *time.Location) int {
	ci := checkIn.In(loc)
	co := checkOut.In(loc)
	if co.Before(ci) {
		return 0
	}

	// Define working hours boundaries
	workStart := combineDateAndHM(ci, WorkStartCalc) // 8:30
	workEnd := combineDateAndHM(ci, WorkEndCalc)     // 18:00

	// Check if working full day: checkIn at or before 8:30 and checkOut at or after 18:00
	// Allow 1 minute tolerance for check-in (8:30:00 to 8:31:00) to account for slight delays
	checkInOnTime := !ci.After(workStart.Add(1 * time.Minute))
	checkOutOnTime := !co.Before(workEnd)
	
	if checkInOnTime && checkOutOnTime {
		// Full day: exactly 8 hours (480 minutes)
		// 8:30 to 18:00 = 9.5 hours = 570 minutes, minus 1.5 hours lunch = 8 hours = 480 minutes
		return 480
	}

	// Clamp checkIn to working hours start (8:30)
	if ci.Before(workStart) {
		ci = workStart
	}
	// Clamp checkOut to working hours end (18:00)
	if co.After(workEnd) {
		co = workEnd
	}
	
	// If after clamping, checkOut is before checkIn, return 0
	if co.Before(ci) {
		return 0
	}

	// Calculate total minutes within working hours
	total := int(co.Sub(ci).Minutes())
	if total <= 0 {
		return 0
	}

	// Subtract lunch break overlap (12:00-13:30)
	lunchStart := combineDateAndHM(ci, LunchStart)
	lunchEnd := combineDateAndHM(ci, LunchEnd)
	lunchOverlap := overlapMinutes(ci, co, lunchStart, lunchEnd)

	worked := total - lunchOverlap
	if worked < 0 {
		worked = 0
	}
	return worked
}
