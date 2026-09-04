-- Duplicate-vote prevention used to rely on a read-then-write check in
-- application code, which two simultaneous votes both pass. Move the guarantee
-- into the database.
--
-- Four steps, in this order. Getting the order wrong turns a clean-up into a
-- failed migration: canonicalising before de-duplicating creates the very
-- collisions the unique index would then reject.

-- 1. Room for the new prefixed form. "email:" plus an address at the RFC
--    maximum does not fit in the old 191 characters.
ALTER TABLE `AuditLog` MODIFY `identifier` VARCHAR(255) NOT NULL;

-- 2. Drop the "unknown" bucket.
--
--    The old code recorded a voter with no detectable IP under the literal
--    string 'unknown'. Because that string is the same for everybody, the first
--    such voter on a form permanently blocked every other one. These rows are
--    not a record of anything; they are the bug. Removing them frees the people
--    who were wrongly locked out. Their submissions are untouched.
DELETE FROM `AuditLog` WHERE `identifier` = 'unknown';

-- 3. Canonicalise the identifiers that remain, to match what the application
--    now writes: a namespace prefix, lower case, no IPv4-mapped IPv6 prefix.
--    Without this, everyone who has already voted could vote a second time,
--    because their old identifier would never be generated again.
UPDATE `AuditLog`
   SET `identifier` = CONCAT('email:', LOWER(TRIM(`identifier`)))
 WHERE `identifier` LIKE '%@%'
   AND `identifier` NOT LIKE 'email:%';

UPDATE `AuditLog`
   SET `identifier` = CONCAT('ip:', LOWER(TRIM(REPLACE(`identifier`, '::ffff:', ''))))
 WHERE `identifier` NOT LIKE 'email:%'
   AND `identifier` NOT LIKE 'ip:%';

-- 4. Remove the duplicates that already exist — both the ones the race let
--    through and any created by step 3 collapsing two spellings of one voter
--    into one. Keep the earliest vote in each group; it is the one that was
--    meant to count.
DELETE a FROM `AuditLog` a
  JOIN `AuditLog` b
    ON a.`formId` = b.`formId`
   AND a.`identifier` = b.`identifier`
   AND (b.`createdAt` < a.`createdAt`
        OR (b.`createdAt` = a.`createdAt` AND b.`id` < a.`id`));

-- The composite index is subsumed by the unique constraint.
DROP INDEX `AuditLog_formId_identifier_idx` ON `AuditLog`;

CREATE UNIQUE INDEX `AuditLog_formId_identifier_key` ON `AuditLog`(`formId`, `identifier`);
