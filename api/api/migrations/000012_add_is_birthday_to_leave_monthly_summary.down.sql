-- +migrate Down
-- Remove is_birthday column from leave_monthly_summary table
ALTER TABLE `leave_monthly_summary` 
DROP COLUMN IF EXISTS `is_birthday`;
