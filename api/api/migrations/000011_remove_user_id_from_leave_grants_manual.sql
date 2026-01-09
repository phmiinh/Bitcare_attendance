-- Manual SQL script to remove user_id from leave_grants table
-- Run this directly in MySQL/MariaDB if migration tool doesn't work

USE `time_attendance`;

-- Step 1: Drop foreign key constraint (check exact name in your DB)
ALTER TABLE `leave_grants` 
    DROP FOREIGN KEY `fk_leave_grants_user`;

-- Step 2: Drop unique key that includes user_id
ALTER TABLE `leave_grants` 
    DROP INDEX `uq_grant_monthly`;

-- Step 3: Drop index on user_id
ALTER TABLE `leave_grants` 
    DROP INDEX `idx_leave_grants_user_id`;

-- Step 4: Drop user_id column
ALTER TABLE `leave_grants` 
    DROP COLUMN `user_id`;

-- Step 5: Update grant_type enum to only allow MONTHLY
ALTER TABLE `leave_grants` 
    MODIFY COLUMN `grant_type` ENUM('MONTHLY') NOT NULL;

-- Step 6: Create new unique key without user_id
ALTER TABLE `leave_grants` 
    ADD UNIQUE KEY `uq_grant_monthly` (`grant_year`, `grant_month`, `grant_type`);

-- Verify the result
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'time_attendance' 
    AND TABLE_NAME = 'leave_grants'
ORDER BY ORDINAL_POSITION;
