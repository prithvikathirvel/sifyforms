-- Flatten teams (no hierarchy) and drop team-scoped roles.
--
-- Teams become organizational buckets: they group forms and act as targets for
-- per-form sharing. A user's access is now governed entirely by their
-- organization role (`OrgUser.role`) plus explicit form shares.

-- --------------------------------------------------------------------------
-- Backfill: a TEAM_LEAD previously held full build rights inside their team.
-- Promote the ones whose organization role is only VIEWER to CREATOR, so
-- removing the team-role concept does not silently strip their ability to
-- build. Everyone whose org role is already CREATOR or above keeps it.
-- --------------------------------------------------------------------------
UPDATE `OrgUser` ou
  JOIN `TeamMember` tm ON tm.`userId` = ou.`userId`
   SET ou.`role` = 'CREATOR'
 WHERE tm.`role` = 'TEAM_LEAD'
   AND ou.`role` = 'VIEWER';

-- --------------------------------------------------------------------------
-- TeamMember: drop the team-level role assignment.
-- --------------------------------------------------------------------------
ALTER TABLE `TeamMember`
    DROP COLUMN `roleId`,
    DROP COLUMN `role`;

-- --------------------------------------------------------------------------
-- Team: drop the self-referencing hierarchy (parentId / path / depth).
-- --------------------------------------------------------------------------
ALTER TABLE `Team` DROP FOREIGN KEY `Team_parentId_fkey`;
ALTER TABLE `Team` DROP INDEX `Team_parentId_idx`;
ALTER TABLE `Team` DROP INDEX `Team_orgId_path_idx`;
ALTER TABLE `Team` DROP COLUMN `parentId`;
ALTER TABLE `Team` DROP COLUMN `path`;
ALTER TABLE `Team` DROP COLUMN `depth`;
