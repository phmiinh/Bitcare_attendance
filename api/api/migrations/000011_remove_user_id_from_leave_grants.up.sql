-- +migrate Up
-- Remove user_id column from leave_grants table as it's no longer used
-- All grants are now for all active users (user_id was always NULL for MONTHLY grants)

-- Step 1: Drop foreign key constraint
ALTER TABLE `leave_grants` 
    DROP FOREIGN KEY IF EXISTS `fk_leave_grants_user`;

-- Step 2: Drop unique key that includes user_id
ALTER TABLE `leave_grants` 
    DROP INDEX IF EXISTS `uq_grant_monthly`;

-- Step 3: Drop index on user_id
ALTER TABLE `leave_grants` 
    DROP INDEX IF EXISTS `idx_leave_grants_user_id`;

-- Step 4: Drop user_id column
ALTER TABLE `leave_grants` 
    DROP COLUMN IF EXISTS `user_id`;

-- Step 5: Update grant_type enum to only allow MONTHLY (remove BIRTHDAY and BIRTHDAY_DEDUCTION)
ALTER TABLE `leave_grants` 
    MODIFY COLUMN `grant_type` ENUM('MONTHLY') NOT NULL;

-- Step 6: Create new unique key without user_id (only grant_year, grant_month, grant_type)
ALTER TABLE `leave_grants` 
    ADD UNIQUE KEY `uq_grant_monthly` (`grant_year`, `grant_month`, `grant_type`);
