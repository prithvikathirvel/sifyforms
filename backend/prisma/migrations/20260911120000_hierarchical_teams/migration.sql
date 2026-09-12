-- Hierarchical Teams — Option B (top-down visibility)
-- Add parentId and depth to Team for nested structure

ALTER TABLE `Team` ADD COLUMN `parentId` VARCHAR(191) NULL;
ALTER TABLE `Team` ADD COLUMN `depth` INT NOT NULL DEFAULT 0;

-- Index for tree queries
CREATE INDEX `Team_orgId_parentId_idx` ON `Team`(`orgId`, `parentId`);
CREATE INDEX `Team_parentId_idx` ON `Team`(`parentId`);

-- Self-referential FK, SET NULL on delete (service handles re-parenting)
ALTER TABLE `Team` ADD CONSTRAINT `Team_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing teams stay as roots (parentId NULL, depth 0) — no backfill needed
-- Default team (General) is always root
