-- Public form hardening.
--
-- Four things, all of which exist because the public submission path scoped
-- things to values the browser chooses for itself.
--
--   1. PublicFormSession   — an unguessable, server-issued handle on "this
--                            respondent, this visit". Replaces the email
--                            address as the key for drafts and as the gate in
--                            front of the two public endpoints that answer
--                            questions about other people's data.
--   2. SubmissionUniqueValue — the database constraint behind `unique` fields.
--                            The application check was read-then-write.
--   3. PublicRateCounter   — a budget counter every replica shares, for limits
--                            that are facts about an organization rather than
--                            about one process.
--   4. Draft.sessionId     — the column that authorises a draft read.
--
-- IMPORTANT, and the one step that is not automatic: SubmissionUniqueValue
-- starts empty, so until it is filled from the submissions that already exist
-- a repeat of an older answer will not be detected. `scripts/db-migrate.mjs`
-- runs the backfill immediately after this migration. If migrations are
-- applied some other way, run it by hand:
--
--     node scripts/backfill-unique-values.mjs
--
-- It is idempotent (INSERT IGNORE) and safe to run repeatedly.

-- 1. Sessions ----------------------------------------------------------------

CREATE TABLE `PublicFormSession` (
    `id`               VARCHAR(191) NOT NULL,
    `formId`           VARCHAR(191) NOT NULL,
    -- The token itself is never stored. A database backup must not be a bag of
    -- live sessions.
    `tokenHash`        VARCHAR(64)  NOT NULL,
    -- Written only by a server-side verification step. Nothing a client sends
    -- can reach this column.
    `verifiedIdentity` VARCHAR(320) NULL,
    `verifiedAt`       DATETIME(3)  NULL,
    `uniqueChecks`     INTEGER      NOT NULL DEFAULT 0,
    `externalChecks`   INTEGER      NOT NULL DEFAULT 0,
    `createdAt`        DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt`       DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt`        DATETIME(3)  NOT NULL,

    UNIQUE INDEX `PublicFormSession_tokenHash_key`(`tokenHash`),
    INDEX `PublicFormSession_formId_idx`(`formId`),
    -- Sweeping expired sessions is a range scan on this column.
    INDEX `PublicFormSession_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PublicFormSession`
  ADD CONSTRAINT `PublicFormSession_formId_fkey`
  FOREIGN KEY (`formId`) REFERENCES `Form`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. The uniqueness constraint ------------------------------------------------

CREATE TABLE `SubmissionUniqueValue` (
    `id`           VARCHAR(191) NOT NULL,
    `formId`       VARCHAR(191) NOT NULL,
    `fieldId`      VARCHAR(191) NOT NULL,
    -- sha256 of the canonicalised answer. Hashing keeps this table from being
    -- a plaintext index of every address and identity number ever submitted,
    -- which matters because a public endpoint queries it.
    `valueHash`    VARCHAR(64)  NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `createdAt`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    -- The guarantee. Not an index for speed — it is what makes two
    -- simultaneous submissions of the same value impossible, because the
    -- database rejects the second insert instead of application code losing a
    -- race it cannot win.
    UNIQUE INDEX `SubmissionUniqueValue_formId_fieldId_valueHash_key`(`formId`, `fieldId`, `valueHash`),
    INDEX `SubmissionUniqueValue_submissionId_idx`(`submissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `SubmissionUniqueValue`
  ADD CONSTRAINT `SubmissionUniqueValue_formId_fkey`
  FOREIGN KEY (`formId`) REFERENCES `Form`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Deleting a submission releases the values it claimed. This is also what
-- unwinds a lost race: the loser's submission row is removed and its claims go
-- with it.
ALTER TABLE `SubmissionUniqueValue`
  ADD CONSTRAINT `SubmissionUniqueValue_submissionId_fkey`
  FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Shared budget counters ---------------------------------------------------

CREATE TABLE `PublicRateCounter` (
    `scope`       VARCHAR(191) NOT NULL,
    `windowStart` DATETIME(3)  NOT NULL,
    `count`       INTEGER      NOT NULL DEFAULT 0,

    INDEX `PublicRateCounter_windowStart_idx`(`windowStart`),
    PRIMARY KEY (`scope`, `windowStart`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. Drafts stop being keyed on an email address ------------------------------

ALTER TABLE `Draft` ADD COLUMN `sessionId` VARCHAR(191) NULL;

-- `identity` becomes a label rather than a key. Two respondents on one form can
-- now legitimately hold drafts under the same (or no) identity, because what
-- separates them is the session.
ALTER TABLE `Draft` MODIFY `identity` VARCHAR(191) NULL;
DROP INDEX `Draft_formId_identity_key` ON `Draft`;

CREATE UNIQUE INDEX `Draft_formId_sessionId_key` ON `Draft`(`formId`, `sessionId`);

ALTER TABLE `Draft`
  ADD CONSTRAINT `Draft_sessionId_fkey`
  FOREIGN KEY (`sessionId`) REFERENCES `PublicFormSession`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Rows written before this migration have no session and are therefore no
-- longer readable. That is the fix, not a casualty of it: every one of them was
-- readable by anybody who could guess an email address. They are left in place
-- rather than deleted so an operator can inspect or migrate them deliberately.
