-- Persist only SHA-256 hashes of verified Turnstile tokens. The unique index
-- makes claiming a token atomic across API replicas and serverless instances.
CREATE TABLE `TurnstileTokenUse` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `formId` VARCHAR(191) NOT NULL,
    `usedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `TurnstileTokenUse_tokenHash_key`(`tokenHash`),
    INDEX `TurnstileTokenUse_expiresAt_idx`(`expiresAt`),
    INDEX `TurnstileTokenUse_formId_usedAt_idx`(`formId`, `usedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
