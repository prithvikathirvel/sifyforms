-- Organizations are registered in the user-management service and given their own
-- role definitions before they may be used. Existing rows are already usable, so
-- they default to ACTIVE.
ALTER TABLE `Organization`
    ADD COLUMN `provisioningStatus` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `umsSyncedAt` DATETIME(3) NULL;

-- "ORG_MEMBER" was never a role this application defines, so a row created with
-- the old default resolved to no permissions at all.
ALTER TABLE `OrgUser` ALTER COLUMN `role` SET DEFAULT 'VIEWER';
ALTER TABLE `OrgInvite` ALTER COLUMN `role` SET DEFAULT 'CREATOR';

-- Last-known-good role definitions, so a restart while the user-management
-- service is unreachable is not a full outage.
CREATE TABLE `RoleDefinitionCache` (
    `id` VARCHAR(191) NOT NULL,
    `appId` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RoleDefinitionCache_appId_orgId_key`(`appId`, `orgId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Work owed to the user-management service, written in the same transaction as
-- the local change it mirrors.
CREATE TABLE `UmsOutbox` (
    `id` VARCHAR(191) NOT NULL,
    `kind` VARCHAR(191) NOT NULL,
    `orgId` VARCHAR(191) NOT NULL,
    `payload` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastError` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `UmsOutbox_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `UmsOutbox_orgId_idx`(`orgId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
