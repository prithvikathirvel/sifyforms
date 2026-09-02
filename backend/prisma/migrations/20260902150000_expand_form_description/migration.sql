-- Form descriptions are user-authored content and can legitimately exceed
-- MySQL's default VARCHAR(191). This is a widening conversion and preserves data.
ALTER TABLE `Form` MODIFY `description` TEXT NULL;
