-- Script to recreate leave_grants table without user_id column
-- This table tracks monthly leave grants to prevent duplicate grants

USE `time_attendance`;

-- Drop table if exists (for safety)
DROP TABLE IF EXISTS `leave_grants`;

-- Create leave_grants table
CREATE TABLE `leave_grants` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `grant_year` INT NOT NULL,
  `grant_month` INT NOT NULL,
  `grant_type` ENUM('MONTHLY') NOT NULL,
  `created_at` DATETIME(3) NOT NULL,
  `deleted_at` DATETIME(3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_grant_monthly` (`grant_year`, `grant_month`, `grant_type`),
  KEY `idx_grant_year_month` (`grant_year`, `grant_month`),
  KEY `idx_leave_grants_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert existing data if needed (from your dump, you had one record)
-- Uncomment and adjust if you want to restore the existing grant record
-- INSERT INTO `leave_grants` (`grant_year`, `grant_month`, `grant_type`, `created_at`, `deleted_at`) 
-- VALUES (2026, 1, 'MONTHLY', '2026-01-07 22:41:27.429', NULL);

-- Verify the table structure
SELECT 
    COLUMN_NAME, 
    COLUMN_TYPE, 
    IS_NULLABLE, 
    COLUMN_DEFAULT,
    COLUMN_KEY,
    EXTRA
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'time_attendance' 
    AND TABLE_NAME = 'leave_grants'
ORDER BY ORDINAL_POSITION;

SELECT 
    INDEX_NAME, 
    COLUMN_NAME, 
    NON_UNIQUE,
    SEQ_IN_INDEX
FROM INFORMATION_SCHEMA.STATISTICS 
WHERE TABLE_SCHEMA = 'time_attendance' 
    AND TABLE_NAME = 'leave_grants'
ORDER BY INDEX_NAME, SEQ_IN_INDEX;
