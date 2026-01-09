-- Safe SQL script to remove user_id from leave_grants table
-- This script handles cases where constraints/indexes may not exist
-- Run this directly in MySQL/MariaDB

USE `time_attendance`;

-- Step 1: Drop foreign key constraint (if exists)
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
    WHERE TABLE_SCHEMA = 'time_attendance' 
        AND TABLE_NAME = 'leave_grants' 
        AND CONSTRAINT_NAME = 'fk_leave_grants_user'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE `leave_grants` DROP FOREIGN KEY `fk_leave_grants_user`',
    'SELECT "Foreign key fk_leave_grants_user does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Drop unique key that includes user_id (if exists)
SET @uk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'time_attendance' 
        AND TABLE_NAME = 'leave_grants' 
        AND INDEX_NAME = 'uq_grant_monthly'
);

SET @sql = IF(@uk_exists > 0,
    'ALTER TABLE `leave_grants` DROP INDEX `uq_grant_monthly`',
    'SELECT "Unique key uq_grant_monthly does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Drop index on user_id (if exists)
SET @idx_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'time_attendance' 
        AND TABLE_NAME = 'leave_grants' 
        AND INDEX_NAME = 'idx_leave_grants_user_id'
);

SET @sql = IF(@idx_exists > 0,
    'ALTER TABLE `leave_grants` DROP INDEX `idx_leave_grants_user_id`',
    'SELECT "Index idx_leave_grants_user_id does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 4: Drop user_id column (if exists)
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'time_attendance' 
        AND TABLE_NAME = 'leave_grants' 
        AND COLUMN_NAME = 'user_id'
);

SET @sql = IF(@col_exists > 0,
    'ALTER TABLE `leave_grants` DROP COLUMN `user_id`',
    'SELECT "Column user_id does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

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

SELECT 
    INDEX_NAME, 
    COLUMN_NAME, 
    NON_UNIQUE
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'time_attendance' 
    AND TABLE_NAME = 'leave_grants'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
