-- +migrate Up
-- Add is_birthday column to leave_monthly_summary table
ALTER TABLE `leave_monthly_summary` 
ADD COLUMN `is_birthday` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if this is the user''s birthday month, 0 otherwise';

-- Update existing records to set is_birthday based on user birthday
UPDATE `leave_monthly_summary` lms
INNER JOIN `users` u ON lms.user_id = u.id
SET lms.is_birthday = 1
WHERE u.birthday IS NOT NULL 
  AND MONTH(u.birthday) = lms.month;
