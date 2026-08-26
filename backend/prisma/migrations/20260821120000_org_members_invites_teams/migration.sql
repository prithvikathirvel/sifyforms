-- Organization membership, invitations and (nested) teams.

-- --------------------------------------------------------------------------
-- OrgUser: `role` becomes a cached role NAME, `roleId` references the RBAC role
-- --------------------------------------------------------------------------
ALTER TABLE `OrgUser`
    ADD COLUMN `roleId`    VARCHAR(191) NULL,
    ADD COLUMN `invitedBy` VARCHAR(191) NULL,
    ADD COLUMN `joinedAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY COLUMN `role`   VARCHAR(191) NOT NULL DEFAULT 'ORG_MEMBER';

-- pre-existing free-text roles map onto the new named roles
UPDATE `OrgUser` SET `role` = 'ORG_ADMIN'  WHERE `role` IN ('owner', 'admin');
UPDATE `OrgUser` SET `role` = 'ORG_MEMBER' WHERE `role` IN ('editor', 'viewer', 'member', '');

CREATE INDEX `OrgUser_userId_idx` ON `OrgUser`(`userId`);

-- --------------------------------------------------------------------------
-- OrgInvite
-- --------------------------------------------------------------------------
CREATE TABLE `OrgInvite` (
    `id`           VARCHAR(191) NOT NULL,
    `email`        VARCHAR(191) NOT NULL,
    `orgId`        VARCHAR(191) NOT NULL,
    `roleId`       VARCHAR(191) NULL,
    `role`         VARCHAR(191) NOT NULL DEFAULT 'ORG_MEMBER',
    `inviteStatus` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `invitedBy`    VARCHAR(191) NOT NULL,
    `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `respondedAt`  DATETIME(3)  NULL,

    UNIQUE INDEX `OrgInvite_orgId_email_key`(`orgId`, `email`),
    INDEX `OrgInvite_email_inviteStatus_idx`(`email`, `inviteStatus`),
    INDEX `OrgInvite_orgId_inviteStatus_idx`(`orgId`, `inviteStatus`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `OrgInvite`
    ADD CONSTRAINT `OrgInvite_orgId_fkey`
    FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Team (self-referencing; `path` is the materialized ancestry of team ids)
-- --------------------------------------------------------------------------
CREATE TABLE `Team` (
    `id`          VARCHAR(191) NOT NULL,
    `orgId`       VARCHAR(191) NOT NULL,
    `parentId`    VARCHAR(191) NULL,
    `name`        VARCHAR(191) NOT NULL,
    `slug`        VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `path`        VARCHAR(512) NOT NULL,
    `depth`       INTEGER      NOT NULL DEFAULT 0,
    `createdBy`   VARCHAR(191) NOT NULL,
    `createdAt`   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3)  NOT NULL,

    UNIQUE INDEX `Team_orgId_slug_key`(`orgId`, `slug`),
    INDEX `Team_orgId_idx`(`orgId`),
    INDEX `Team_parentId_idx`(`parentId`),
    INDEX `Team_orgId_path_idx`(`orgId`, `path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Team`
    ADD CONSTRAINT `Team_orgId_fkey`
    FOREIGN KEY (`orgId`) REFERENCES `Organization`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RESTRICT, not CASCADE: deleting a parent team with children must be an
-- explicit decision made by the service layer, not a silent subtree wipe.
ALTER TABLE `Team`
    ADD CONSTRAINT `Team_parentId_fkey`
    FOREIGN KEY (`parentId`) REFERENCES `Team`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- TeamMember (one role per person per team)
-- --------------------------------------------------------------------------
CREATE TABLE `TeamMember` (
    `id`        VARCHAR(191) NOT NULL,
    `teamId`    VARCHAR(191) NOT NULL,
    `userId`    VARCHAR(191) NOT NULL,
    `roleId`    VARCHAR(191) NULL,
    `role`      VARCHAR(191) NOT NULL DEFAULT 'TEAM_MEMBER',
    `addedBy`   VARCHAR(191) NULL,
    `createdAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3)  NOT NULL,

    UNIQUE INDEX `TeamMember_teamId_userId_key`(`teamId`, `userId`),
    INDEX `TeamMember_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `TeamMember`
    ADD CONSTRAINT `TeamMember_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `TeamMember`
    ADD CONSTRAINT `TeamMember_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Backfill: every org owner becomes an explicit ORG_ADMIN member, so authz can
-- read one table instead of special-casing `Organization.ownerId` everywhere.
-- --------------------------------------------------------------------------
INSERT INTO `OrgUser` (`id`, `orgId`, `userId`, `role`, `joinedAt`)
SELECT CONCAT('own_', o.`id`), o.`id`, o.`ownerId`, 'ORG_ADMIN', o.`createdAt`
  FROM `Organization` o
 WHERE NOT EXISTS (
       SELECT 1 FROM `OrgUser` ou
        WHERE ou.`orgId` = o.`id` AND ou.`userId` = o.`ownerId`
 );

UPDATE `OrgUser` ou
  JOIN `Organization` o ON o.`id` = ou.`orgId`
   SET ou.`role` = 'ORG_ADMIN'
 WHERE ou.`userId` = o.`ownerId`;
