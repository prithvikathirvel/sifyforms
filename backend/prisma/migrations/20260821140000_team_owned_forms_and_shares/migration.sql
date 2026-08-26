-- Forms belong to teams; response visibility becomes a property of the form;
-- per-form shares provide the exception path around roles.

-- --------------------------------------------------------------------------
-- Team: mark the organization's default landing team
-- --------------------------------------------------------------------------
ALTER TABLE `Team`
    ADD COLUMN `isDefault` BOOLEAN NOT NULL DEFAULT false;

-- --------------------------------------------------------------------------
-- Form: owning team + response-visibility policy
-- --------------------------------------------------------------------------
ALTER TABLE `Form`
    ADD COLUMN `teamId`                 VARCHAR(191) NULL,
    ADD COLUMN `responsePolicy`         VARCHAR(191) NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN `responsePolicyLockedAt` DATETIME(3)  NULL;

CREATE INDEX `Form_teamId_idx` ON `Form`(`teamId`);

-- SET NULL, not CASCADE: deleting a team must never delete the forms and
-- responses it happened to hold. Orphaned forms fall back to the default team.
ALTER TABLE `Form`
    ADD CONSTRAINT `Form_teamId_fkey`
    FOREIGN KEY (`teamId`) REFERENCES `Team`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- FormShare
-- --------------------------------------------------------------------------
CREATE TABLE `FormShare` (
    `id`            VARCHAR(191) NOT NULL,
    `formId`        VARCHAR(191) NOT NULL,
    `principalType` VARCHAR(191) NOT NULL,
    `principalId`   VARCHAR(191) NOT NULL,
    `level`         VARCHAR(191) NOT NULL DEFAULT 'AGGREGATE',
    `canEdit`       BOOLEAN      NOT NULL DEFAULT false,
    `expiresAt`     DATETIME(3)  NULL,
    `createdBy`     VARCHAR(191) NOT NULL,
    `createdAt`     DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`     DATETIME(3)  NOT NULL,

    UNIQUE INDEX `FormShare_formId_principalType_principalId_key`(`formId`, `principalType`, `principalId`),
    INDEX `FormShare_principalType_principalId_idx`(`principalType`, `principalId`),
    INDEX `FormShare_formId_idx`(`formId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `FormShare`
    ADD CONSTRAINT `FormShare_formId_fkey`
    FOREIGN KEY (`formId`) REFERENCES `Form`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- --------------------------------------------------------------------------
-- Backfill: give every organization a General team, and home its forms there.
-- Without this, existing forms would be governed by nothing.
-- --------------------------------------------------------------------------
INSERT INTO `Team` (`id`, `orgId`, `parentId`, `name`, `slug`, `description`, `path`, `depth`, `isDefault`, `createdBy`, `createdAt`, `updatedAt`)
SELECT
    CONCAT('gen_', o.`id`),
    o.`id`,
    NULL,
    'General',
    'general',
    'Default team. Forms without a team of their own live here.',
    CONCAT('/gen_', o.`id`),
    0,
    true,
    o.`ownerId`,
    o.`createdAt`,
    o.`createdAt`
  FROM `Organization` o
 WHERE NOT EXISTS (
       SELECT 1 FROM `Team` t WHERE t.`orgId` = o.`id` AND t.`slug` = 'general'
 );

-- Every existing org member leads the General team, preserving the access they
-- had when forms were governed at organization level.
INSERT INTO `TeamMember` (`id`, `teamId`, `userId`, `roleId`, `role`, `addedBy`, `createdAt`, `updatedAt`)
SELECT
    CONCAT('gm_', ou.`id`),
    CONCAT('gen_', ou.`orgId`),
    ou.`userId`,
    NULL,
    'TEAM_LEAD',
    NULL,
    ou.`joinedAt`,
    ou.`joinedAt`
  FROM `OrgUser` ou
 WHERE EXISTS (SELECT 1 FROM `Team` t WHERE t.`id` = CONCAT('gen_', ou.`orgId`))
   AND NOT EXISTS (
       SELECT 1 FROM `TeamMember` tm
        WHERE tm.`teamId` = CONCAT('gen_', ou.`orgId`) AND tm.`userId` = ou.`userId`
 );

UPDATE `Form` f
   JOIN `Team` t ON t.`orgId` = f.`orgId` AND t.`isDefault` = true
   SET f.`teamId` = t.`id`
 WHERE f.`teamId` IS NULL;

-- --------------------------------------------------------------------------
-- Role rename: the four-role set becomes the six-role set.
--   ORG_ADMIN   -> ADMIN   (the org owner is promoted to OWNER below)
--   ORG_MEMBER  -> CREATOR (builds forms; response access drops to aggregate)
--   TEAM_MEMBER -> CREATOR
-- TEAM_LEAD is unchanged.
-- --------------------------------------------------------------------------
UPDATE `OrgUser`   SET `role` = 'ADMIN',   `roleId` = NULL WHERE `role` = 'ORG_ADMIN';
UPDATE `OrgUser`   SET `role` = 'CREATOR', `roleId` = NULL WHERE `role` = 'ORG_MEMBER';
UPDATE `TeamMember` SET `role` = 'CREATOR', `roleId` = NULL WHERE `role` = 'TEAM_MEMBER';
UPDATE `OrgInvite` SET `role` = 'ADMIN',   `roleId` = NULL WHERE `role` = 'ORG_ADMIN';
UPDATE `OrgInvite` SET `role` = 'CREATOR', `roleId` = NULL WHERE `role` = 'ORG_MEMBER';

UPDATE `OrgUser` ou
  JOIN `Organization` o ON o.`id` = ou.`orgId`
   SET ou.`role` = 'OWNER'
 WHERE ou.`userId` = o.`ownerId`;
