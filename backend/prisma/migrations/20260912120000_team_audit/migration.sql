-- Team audit: track who last updated a team
ALTER TABLE `Team` ADD COLUMN `updatedBy` VARCHAR(191) NULL;
CREATE INDEX `Team_updatedBy_idx` ON `Team`(`updatedBy`);
