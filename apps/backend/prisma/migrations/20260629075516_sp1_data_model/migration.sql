-- AlterTable
ALTER TABLE `borrower` ADD COLUMN `actualAddress` TEXT NULL,
    ADD COLUMN `actualLandmark` VARCHAR(191) NULL,
    ADD COLUMN `actualTenure` VARCHAR(191) NULL,
    ADD COLUMN `childrenCount` INTEGER NULL,
    ADD COLUMN `citizenship` VARCHAR(191) NULL,
    ADD COLUMN `depositsBand` VARCHAR(191) NULL,
    ADD COLUMN `education` VARCHAR(191) NULL,
    ADD COLUMN `familySize` INTEGER NULL,
    ADD COLUMN `gender` ENUM('MALE', 'FEMALE') NULL,
    ADD COLUMN `inn` VARCHAR(191) NULL,
    ADD COLUMN `maritalStatus` VARCHAR(191) NULL,
    ADD COLUMN `ownsHome` VARCHAR(191) NULL,
    ADD COLUMN `passportExpiry` DATETIME(3) NULL,
    ADD COLUMN `passportIssueDate` DATETIME(3) NULL,
    ADD COLUMN `passportIssuer` TEXT NULL,
    ADD COLUMN `phones` JSON NULL,
    ADD COLUMN `placeOfBirth` VARCHAR(191) NULL,
    ADD COLUMN `previousName` VARCHAR(191) NULL,
    ADD COLUMN `regAddress` TEXT NULL,
    ADD COLUMN `regLandmark` VARCHAR(191) NULL,
    ADD COLUMN `regMatchesActual` BOOLEAN NULL,
    ADD COLUMN `regTenure` VARCHAR(191) NULL,
    ADD COLUMN `residenceDuration` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `collateral` ADD COLUMN `landAreaM2` DOUBLE NULL,
    ADD COLUMN `position` INTEGER NULL,
    ADD COLUMN `usableAreaM2` DOUBLE NULL;

-- AlterTable
ALTER TABLE `collateralowner` ADD COLUMN `birthDate` DATETIME(3) NULL,
    ADD COLUMN `isBorrowerOwner` BOOLEAN NULL,
    ADD COLUMN `passportIssuer` TEXT NULL,
    ADD COLUMN `regAddress` TEXT NULL;

-- CreateTable
CREATE TABLE `Organization` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `nameMixed` VARCHAR(191) NOT NULL,
    `nameUpper` VARCHAR(191) NOT NULL,
    `nameSuffix` VARCHAR(191) NOT NULL,
    `directorShort` VARCHAR(191) NOT NULL,
    `directorFull` VARCHAR(191) NOT NULL,
    `legalBasis` VARCHAR(191) NOT NULL DEFAULT 'Низом',
    `address` TEXT NOT NULL,
    `bankAccount` VARCHAR(191) NOT NULL,
    `bankMfo` VARCHAR(191) NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `inn` VARCHAR(191) NOT NULL,
    `licenseNo` VARCHAR(191) NOT NULL,
    `licenseDate` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditLine` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `lineNumber` VARCHAR(191) NULL,
    `loanType` ENUM('MICROLOAN', 'MICROCREDIT') NULL,
    `amountAuto` DECIMAL(18, 2) NULL,
    `amountPolis` DECIMAL(18, 2) NULL,
    `amountTotal` DECIMAL(18, 2) NULL,
    `termMonths` INTEGER NULL,
    `lineDate` DATETIME(3) NULL,
    `lineMaturity` DATETIME(3) NULL,
    `interestRate` DECIMAL(6, 4) NULL,
    `penaltyRate` DECIMAL(6, 4) NULL,
    `orderNumber` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CreditLine_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tranche` (
    `id` VARCHAR(191) NOT NULL,
    `creditLineId` VARCHAR(191) NOT NULL,
    `trancheNo` INTEGER NOT NULL,
    `applicationNo` VARCHAR(191) NULL,
    `applicationDate` DATETIME(3) NULL,
    `contractNo` VARCHAR(191) NULL,
    `contractDate` DATETIME(3) NULL,
    `principal` DECIMAL(18, 2) NULL,
    `termMonths` INTEGER NULL,
    `maturity` DATETIME(3) NULL,
    `scheduleType` ENUM('ANNUITY', 'DIFFERENTIATED') NULL,
    `monthlyPayment` DECIMAL(18, 2) NULL,
    `insurancePayment` DECIMAL(18, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Tranche_creditLineId_idx`(`creditLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentSchedule` (
    `id` VARCHAR(191) NOT NULL,
    `trancheId` VARCHAR(191) NOT NULL,
    `method` ENUM('ANNUITY', 'DIFFERENTIATED') NOT NULL,
    `principal` DECIMAL(18, 2) NOT NULL,
    `termMonths` INTEGER NOT NULL,
    `annualRate` DECIMAL(6, 4) NOT NULL,
    `disbursementDate` DATETIME(3) NOT NULL,
    `paymentDayCap` INTEGER NOT NULL DEFAULT 25,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PaymentSchedule_trancheId_key`(`trancheId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Installment` (
    `id` VARCHAR(191) NOT NULL,
    `scheduleId` VARCHAR(191) NOT NULL,
    `seq` INTEGER NOT NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `openingBalance` DECIMAL(18, 2) NOT NULL,
    `principal` DECIMAL(18, 2) NOT NULL,
    `interest` DECIMAL(18, 2) NOT NULL,
    `total` DECIMAL(18, 2) NOT NULL,
    `days` INTEGER NOT NULL,

    INDEX `Installment_scheduleId_idx`(`scheduleId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InsurancePolicy` (
    `id` VARCHAR(191) NOT NULL,
    `creditLineId` VARCHAR(191) NOT NULL,
    `insured` BOOLEAN NOT NULL DEFAULT false,
    `company` VARCHAR(191) NULL,
    `genAgreementNo` VARCHAR(191) NULL,
    `genAgreementDate` DATETIME(3) NULL,
    `policyNo` VARCHAR(191) NULL,
    `policyIssueDate` DATETIME(3) NULL,
    `policyTermMonths` INTEGER NULL,
    `policyExpiry` DATETIME(3) NULL,
    `loanUnderPolicy` DECIMAL(18, 2) NULL,
    `insuredSum` DECIMAL(18, 2) NULL,
    `insuranceRate` DECIMAL(6, 4) NULL,
    `premium` DECIMAL(18, 2) NULL,

    UNIQUE INDEX `InsurancePolicy_creditLineId_key`(`creditLineId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employment` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `employer` VARCHAR(191) NULL,
    `employerAddress` TEXT NULL,
    `sector` VARCHAR(191) NULL,
    `sectorRiskCode` INTEGER NULL,
    `position` VARCHAR(191) NULL,
    `employedSince` VARCHAR(191) NULL,
    `experienceBand` VARCHAR(191) NULL,

    UNIQUE INDEX `Employment_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Affordability` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `avgMonthlyIncome` DECIMAL(18, 2) NULL,
    `mainActivityIncome` DECIMAL(18, 2) NULL,
    `secondaryIncome` DECIMAL(18, 2) NULL,
    `familyIncome` DECIMAL(18, 2) NULL,
    `otherIncome` DECIMAL(18, 2) NULL,
    `newLoanPayment` DECIMAL(18, 2) NULL,
    `utilitiesExpense` DECIMAL(18, 2) NULL,
    `familyExpense` DECIMAL(18, 2) NULL,
    `existingCreditBurden` DECIMAL(18, 2) NULL,
    `otherExpense` DECIMAL(18, 2) NULL,
    `totalIncome` DECIMAL(18, 2) NULL,
    `totalCreditPayments` DECIMAL(18, 2) NULL,
    `totalExpenses` DECIMAL(18, 2) NULL,
    `dtiRatio` DOUBLE NULL,
    `surplus` DECIMAL(18, 2) NULL,
    `netAfterDebt` DECIMAL(18, 2) NULL,
    `computedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Affordability_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CreditHistory` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `repaidLoansCount` INTEGER NULL,
    `activeLoansCount` INTEGER NULL,
    `overdueSubstandardFlag` INTEGER NULL,
    `otherObligations` INTEGER NULL,
    `loansOver5MFlag` VARCHAR(191) NULL,
    `priorMfiPawnshopFlag` VARCHAR(191) NULL,
    `totalOutstandingDebt` DECIMAL(18, 2) NULL,
    `avgMonthlyPaymentExisting` DECIMAL(18, 2) NULL,
    `committeeProtocolRef` VARCHAR(191) NULL,
    `committeeDecisionDate` DATETIME(3) NULL,

    UNIQUE INDEX `CreditHistory_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScoringResult` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `totalScore` INTEGER NOT NULL,
    `maxScore` INTEGER NOT NULL DEFAULT 100,
    `verdict` ENUM('APPROVED', 'REFER_COMMITTEE', 'BELOW_MIN', 'FAILED_INCOME', 'FAILED_PROBLEM_LOANS') NOT NULL,
    `age` DOUBLE NULL,
    `monthlyTranches` DECIMAL(18, 2) NULL,
    `monthlyIncome` DECIMAL(18, 2) NULL,
    `monthlyExpenses` DECIMAL(18, 2) NULL,
    `surplus` DECIMAL(18, 2) NULL,
    `netAfterDebt` DECIMAL(18, 2) NULL,
    `computedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ScoringResult_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScoringFactor` (
    `id` VARCHAR(191) NOT NULL,
    `resultId` VARCHAR(191) NOT NULL,
    `factorNo` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `points` INTEGER NOT NULL,
    `maxPoints` INTEGER NOT NULL,

    INDEX `ScoringFactor_resultId_idx`(`resultId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IncomeCertificate` (
    `id` VARCHAR(191) NOT NULL,
    `caseId` VARCHAR(191) NOT NULL,
    `employer` VARCHAR(191) NULL,
    `position` VARCHAR(191) NULL,
    `certNo` VARCHAR(191) NULL,
    `certDate` DATETIME(3) NULL,
    `avgMonthlyNet` DECIMAL(18, 2) NULL,

    UNIQUE INDEX `IncomeCertificate_caseId_key`(`caseId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SalaryMonth` (
    `id` VARCHAR(191) NOT NULL,
    `certificateId` VARCHAR(191) NOT NULL,
    `monthIndex` INTEGER NOT NULL,
    `gross` DECIMAL(18, 2) NULL,
    `tax` DECIMAL(18, 2) NULL,
    `net` DECIMAL(18, 2) NULL,

    INDEX `SalaryMonth_certificateId_idx`(`certificateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CreditLine` ADD CONSTRAINT `CreditLine_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tranche` ADD CONSTRAINT `Tranche_creditLineId_fkey` FOREIGN KEY (`creditLineId`) REFERENCES `CreditLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PaymentSchedule` ADD CONSTRAINT `PaymentSchedule_trancheId_fkey` FOREIGN KEY (`trancheId`) REFERENCES `Tranche`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Installment` ADD CONSTRAINT `Installment_scheduleId_fkey` FOREIGN KEY (`scheduleId`) REFERENCES `PaymentSchedule`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InsurancePolicy` ADD CONSTRAINT `InsurancePolicy_creditLineId_fkey` FOREIGN KEY (`creditLineId`) REFERENCES `CreditLine`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Employment` ADD CONSTRAINT `Employment_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Affordability` ADD CONSTRAINT `Affordability_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CreditHistory` ADD CONSTRAINT `CreditHistory_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoringResult` ADD CONSTRAINT `ScoringResult_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScoringFactor` ADD CONSTRAINT `ScoringFactor_resultId_fkey` FOREIGN KEY (`resultId`) REFERENCES `ScoringResult`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IncomeCertificate` ADD CONSTRAINT `IncomeCertificate_caseId_fkey` FOREIGN KEY (`caseId`) REFERENCES `CreditCase`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SalaryMonth` ADD CONSTRAINT `SalaryMonth_certificateId_fkey` FOREIGN KEY (`certificateId`) REFERENCES `IncomeCertificate`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
