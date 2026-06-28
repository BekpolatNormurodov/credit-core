-- CreateTable
CREATE TABLE `Branch` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `region` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Branch_symbol_key`(`symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `login` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `role` ENUM('OPERATOR', 'MODERATOR', 'DIRECTOR', 'ADMIN') NOT NULL,
    `branchId` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_login_key`(`login`),
    INDEX `User_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditCase` (
    `id` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `productType` ENUM('REAL_ESTATE', 'AUTO') NOT NULL,
    `status` ENUM('DRAFT', 'MODERATION', 'DIRECTOR_REVIEW', 'ADMIN_FINALIZE', 'FINALIZED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `amount` DECIMAL(18, 2) NULL,
    `termMonths` INTEGER NULL,
    `katmPrice` DECIMAL(18, 2) NULL,
    `branchId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreditCase_number_key`(`number`),
    INDEX `CreditCase_status_idx`(`status`),
    INDEX `CreditCase_branchId_idx`(`branchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Borrower` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `passportSeries` VARCHAR(191) NULL,
    `passportNumber` VARCHAR(191) NULL,
    `pinfl` VARCHAR(191) NULL,
    `birthDate` DATETIME(3) NULL,
    `address` TEXT NULL,
    `phone` VARCHAR(191) NULL,

    UNIQUE INDEX `Borrower_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RealEstateCollateral` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `address` TEXT NOT NULL,
    `registryNo` VARCHAR(191) NULL,
    `propertyType` VARCHAR(191) NULL,
    `cadastreNo` VARCHAR(191) NULL,
    `registrationDate` DATETIME(3) NULL,
    `totalAreaM2` DOUBLE NULL,
    `livingAreaM2` DOUBLE NULL,
    `roomNames` TEXT NULL,
    `roomCount` INTEGER NULL,
    `agreedValue` DECIMAL(18, 2) NULL,
    `agreedValueWords` TEXT NULL,

    UNIQUE INDEX `RealEstateCollateral_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CollateralOwner` (
    `id` VARCHAR(191) NOT NULL,
    `collateralId` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `passportSeries` VARCHAR(191) NULL,
    `passportNumber` VARCHAR(191) NULL,
    `pinfl` VARCHAR(191) NULL,
    `sharePercent` DOUBLE NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutoCollateral` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
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
    `position` VARCHAR(191) NULL,
    `agreedValue` DECIMAL(18, 2) NULL,
    `agreedValueWords` TEXT NULL,

    UNIQUE INDEX `AutoCollateral_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ValuationAct` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `actNo` VARCHAR(191) NULL,
    `actDate` DATETIME(3) NULL,
    `agreedValue` DECIMAL(18, 2) NULL,
    `agreedValueWords` TEXT NULL,

    UNIQUE INDEX `ValuationAct_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `type` ENUM('NOTARY', 'SCAN', 'COLLATERAL_PHOTO', 'TECH_PASSPORT', 'DIRECTOR_FINAL', 'GENERATED_PDF', 'OTHER') NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `storagePath` VARCHAR(191) NOT NULL,
    `mimeType` VARCHAR(191) NULL,
    `isGenerated` BOOLEAN NOT NULL DEFAULT false,
    `uploadedById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Document_caseId_idx`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkflowEvent` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('DRAFT', 'MODERATION', 'DIRECTOR_REVIEW', 'ADMIN_FINALIZE', 'FINALIZED', 'REJECTED') NULL,
    `toStatus` ENUM('DRAFT', 'MODERATION', 'DIRECTOR_REVIEW', 'ADMIN_FINALIZE', 'FINALIZED', 'REJECTED') NOT NULL,
    `decision` ENUM('SUBMIT', 'APPROVE', 'RETURN', 'FINALIZE') NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `role` ENUM('OPERATOR', 'MODERATOR', 'DIRECTOR', 'ADMIN') NOT NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WorkflowEvent_caseId_idx`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ImportJob` (
    `id` VARCHAR(191) NOT NULL,
    `sourceFileName` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PARSED',
    `parsedJson` JSON NOT NULL,
    `caseId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditCase` ADD CONSTRAINT `CreditCase_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditCase` ADD CONSTRAINT `CreditCase_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Borrower` ADD CONSTRAINT `Borrower_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RealEstateCollateral` ADD CONSTRAINT `RealEstateCollateral_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CollateralOwner` ADD CONSTRAINT `CollateralOwner_collateralId_fkey` FOREIGN KEY (`collateralId`) REFERENCES `RealEstateCollateral`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutoCollateral` ADD CONSTRAINT `AutoCollateral_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ValuationAct` ADD CONSTRAINT `ValuationAct_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowEvent` ADD CONSTRAINT `WorkflowEvent_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WorkflowEvent` ADD CONSTRAINT `WorkflowEvent_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ImportJob` ADD CONSTRAINT `ImportJob_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
