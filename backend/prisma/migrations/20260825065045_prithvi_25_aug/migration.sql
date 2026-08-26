/*
  Warnings:

  - You are about to drop the column `emailVerified` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `googleId` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `user` table. All the data in the column will be lost.
  - You are about to drop the column `password` on the `user` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `User_googleId_key` ON `user`;

-- AlterTable
ALTER TABLE `draft` MODIFY `data` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `form` MODIFY `schema` LONGTEXT NOT NULL,
    MODIFY `settings` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `submission` ADD COLUMN `processingStatus` VARCHAR(191) NOT NULL DEFAULT 'pending',
    MODIFY `data` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `template` MODIFY `schema` LONGTEXT NOT NULL,
    MODIFY `settings` LONGTEXT NOT NULL;

-- AlterTable
ALTER TABLE `user` DROP COLUMN `emailVerified`,
    DROP COLUMN `googleId`,
    DROP COLUMN `image`,
    DROP COLUMN `name`,
    DROP COLUMN `password`,
    ADD COLUMN `additionalDetails` LONGTEXT NULL,
    ADD COLUMN `address` VARCHAR(191) NULL,
    ADD COLUMN `firstName` VARCHAR(191) NULL,
    ADD COLUMN `gender` VARCHAR(191) NULL,
    ADD COLUMN `lastName` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `username` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ProcessingResult` (
    `id` VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `formId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `result` LONGTEXT NOT NULL,
    `processedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProcessingResult_submissionId_key`(`submissionId`),
    INDEX `ProcessingResult_formId_idx`(`formId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `formId` VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `identifier` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AuditLog_submissionId_key`(`submissionId`),
    INDEX `AuditLog_formId_idx`(`formId`),
    INDEX `AuditLog_formId_identifier_idx`(`formId`, `identifier`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);

-- AddForeignKey
ALTER TABLE `ProcessingResult` ADD CONSTRAINT `ProcessingResult_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_submissionId_fkey` FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
