-- AlterTable
ALTER TABLE `creditcase` ADD COLUMN `overdueNotified` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `pauseUntil` DATETIME(3) NULL,
    ADD COLUMN `pausedAt` DATETIME(3) NULL,
    ADD COLUMN `stepDeadlineAt` DATETIME(3) NULL,
    ADD COLUMN `stepStartedAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('DRAFT', 'MODERATION', 'DIRECTOR_REVIEW', 'ADMIN_FINALIZE', 'FINALIZED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `document` ADD COLUMN `collateralId` VARCHAR(191) NULL,
    ADD COLUMN `description` TEXT NULL,
    ADD COLUMN `messageId` VARCHAR(191) NULL,
    ADD COLUMN `title` VARCHAR(191) NULL,
    MODIFY `type` ENUM('NOTARY', 'SCAN', 'PASSPORT', 'COLLATERAL_PHOTO', 'TECH_PASSPORT', 'DIRECTOR_FINAL', 'GENERATED_PDF', 'CHAT', 'OTHER') NOT NULL;

-- AlterTable
ALTER TABLE `message` ADD COLUMN `editedAt` DATETIME(3) NULL,
    ADD COLUMN `toUserId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `avatarPath` VARCHAR(191) NULL,
    ADD COLUMN `phone` VARCHAR(191) NULL,
    ADD COLUMN `plainPassword` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `workflowevent` MODIFY `fromStatus` ENUM('DRAFT', 'MODERATION', 'DIRECTOR_REVIEW', 'ADMIN_FINALIZE', 'FINALIZED', 'REJECTED', 'CANCELLED') NULL,
    MODIFY `toStatus` ENUM('DRAFT', 'MODERATION', 'DIRECTOR_REVIEW', 'ADMIN_FINALIZE', 'FINALIZED', 'REJECTED', 'CANCELLED') NOT NULL,
    MODIFY `decision` ENUM('SUBMIT', 'APPROVE', 'RETURN', 'FINALIZE', 'CANCEL', 'REOPEN') NOT NULL;

-- CreateTable
CREATE TABLE `StepSetting` (
    `step` ENUM('DRAFT', 'MODERATION', 'DIRECTOR_REVIEW', 'ADMIN_FINALIZE', 'FINALIZED', 'REJECTED', 'CANCELLED') NOT NULL,
    `businessDays` INTEGER NOT NULL DEFAULT 2,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`step`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppConfig` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `maxPauseDays` INTEGER NOT NULL DEFAULT 5,
    `markupPercent` DOUBLE NOT NULL DEFAULT 0.41,
    `bankRate` DOUBLE NOT NULL DEFAULT 0.28,
    `taxRate` DOUBLE NOT NULL DEFAULT 0.12,
    `nplRate` DOUBLE NOT NULL DEFAULT 0.05,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_BranchModerators` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_BranchModerators_AB_unique`(`A`, `B`),
    INDEX `_BranchModerators_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `CreditCase_stepDeadlineAt_idx` ON `CreditCase`(`stepDeadlineAt`);

-- CreateIndex
CREATE INDEX `Document_messageId_idx` ON `Document`(`messageId`);

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `Message`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_BranchModerators` ADD CONSTRAINT `_BranchModerators_A_fkey` FOREIGN KEY (`A`) REFERENCES `Branch`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_BranchModerators` ADD CONSTRAINT `_BranchModerators_B_fkey` FOREIGN KEY (`B`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
