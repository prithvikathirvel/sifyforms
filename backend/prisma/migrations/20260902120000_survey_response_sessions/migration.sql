CREATE TABLE `SurveyResponseSession` (
  `id` VARCHAR(191) NOT NULL,
  `formId` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `data` LONGTEXT NOT NULL,
  `stepIndex` INTEGER NOT NULL DEFAULT 0,
  `completedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `SurveyResponseSession_formId_tokenHash_key`(`formId`, `tokenHash`),
  INDEX `SurveyResponseSession_formId_completedAt_idx`(`formId`, `completedAt`),
  CONSTRAINT `SurveyResponseSession_formId_fkey` FOREIGN KEY (`formId`) REFERENCES `Form`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
