/*
  Warnings:

  - You are about to drop the `autocollateral` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `realestatecollateral` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `autocollateral` DROP FOREIGN KEY `AutoCollateral_caseId_fkey`;

-- DropForeignKey
ALTER TABLE `collateralowner` DROP FOREIGN KEY `CollateralOwner_collateralId_fkey`;

-- DropForeignKey
ALTER TABLE `realestatecollateral` DROP FOREIGN KEY `RealEstateCollateral_caseId_fkey`;

-- DropIndex
DROP INDEX `CollateralOwner_collateralId_fkey` ON `collateralowner`;

-- DropTable
DROP TABLE `autocollateral`;

-- DropTable
DROP TABLE `realestatecollateral`;

-- CreateTable
CREATE TABLE `Collateral` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `type` ENUM('REAL_ESTATE', 'AUTO') NOT NULL,
    `agreedValue` DECIMAL(18, 2) NULL,
    `agreedValueWords` TEXT NULL,
    `address` TEXT NULL,
    `registryNo` VARCHAR(191) NULL,
    `propertyType` VARCHAR(191) NULL,
    `cadastreNo` VARCHAR(191) NULL,
    `registrationDate` DATETIME(3) NULL,
    `totalAreaM2` DOUBLE NULL,
    `livingAreaM2` DOUBLE NULL,
    `roomNames` TEXT NULL,
    `roomCount` INTEGER NULL,
    `techPassportNo` VARCHAR(191) NULL,
    `techPassportDate` DATETIME(3) NULL,
    `model` VARCHAR(191) NULL,
    `stateNumber` VARCHAR(191) NULL,
    `bodyType` VARCHAR(191) NULL,
    `bodyNo` VARCHAR(191) NULL,
    `engineNo` VARCHAR(191) NULL,
    `chassis` VARCHAR(191) NULL,
    `color` VARCHAR(191) NULL,
    `year` INTEGER NULL,
    `mileage` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Collateral_caseId_idx`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Collateral` ADD CONSTRAINT `Collateral_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollateralOwner` ADD CONSTRAINT `CollateralOwner_collateralId_fkey` FOREIGN KEY (`collateralId`) REFERENCES `Collateral`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
