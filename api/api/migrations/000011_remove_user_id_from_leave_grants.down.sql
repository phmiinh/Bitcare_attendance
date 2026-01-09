-- +migrate Down
-- Restore user_id column and grant_type enum (for rollback purposes)

-- Step 1: Drop unique key
ALTER TABLE `leave_grants` 
    DROP INDEX IF EXISTS `uq_grant_monthly`;

-- Step 2: Restore grant_type enum
ALTER TABLE `leave_grants` 
    MODIFY COLUMN `grant_type` ENUM('MONTHLY','BIRTHDAY','BIRTHDAY_DEDUCTION') NOT NULL;

-- Step 3: Add user_id column back
ALTER TABLE `leave_grants` 
    ADD COLUMN `user_id` BIGINT UNSIGNED NULL;

-- Step 4: Add index on user_id
ALTER TABLE `leave_grants` 
    ADD INDEX `idx_leave_grants_user_id` (`user_id`);

-- Step 5: Add unique key with user_id
ALTER TABLE `leave_grants` 
    ADD UNIQUE KEY `uq_grant_monthly` (`grant_year`, `grant_month`, `grant_type`, `user_id`);

-- Step 6: Add foreign key constraint
ALTER TABLE `leave_grants` 
    ADD CONSTRAINT `fk_leave_grants_user` 
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) 
    ON DELETE CASCADE ON UPDATE CASCADE;
