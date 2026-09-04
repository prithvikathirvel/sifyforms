-- Duplicate-vote prevention used to rely on a read-then-write check in
-- application code, which two simultaneous votes both pass. Move the guarantee
-- into the database.
--
-- Existing rows may already contain duplicates (that is the bug), so drop the
-- extras first, keeping the earliest vote for each identifier.
DELETE a FROM `AuditLog` a
  JOIN `AuditLog` b
    ON a.`formId` = b.`formId`
   AND a.`identifier` = b.`identifier`
   AND (b.`createdAt` < a.`createdAt`
        OR (b.`createdAt` = a.`createdAt` AND b.`id` < a.`id`));

-- The composite index is subsumed by the unique constraint below.
DROP INDEX `AuditLog_formId_identifier_idx` ON `AuditLog`;

CREATE UNIQUE INDEX `AuditLog_formId_identifier_key` ON `AuditLog`(`formId`, `identifier`);
