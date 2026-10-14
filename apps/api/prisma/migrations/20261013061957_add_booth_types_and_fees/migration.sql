-- AlterTable
ALTER TABLE `Booking` ADD COLUMN `feesSnapshot` JSON NULL;

-- AlterTable
ALTER TABLE `Booth` ADD COLUMN `boothTypeId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `BoothType` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `physicalWidth` DECIMAL(8, 2) NULL,
    `physicalLength` DECIMAL(8, 2) NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `BoothType_eventId_idx`(`eventId`),
    UNIQUE INDEX `BoothType_eventId_name_key`(`eventId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EventFee` (
    `id` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `type` ENUM('PER_BOOKING', 'PER_BOOTH') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `EventFee_eventId_idx`(`eventId`),
    UNIQUE INDEX `EventFee_eventId_name_key`(`eventId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Booth_boothTypeId_idx` ON `Booth`(`boothTypeId`);

-- AddForeignKey
ALTER TABLE `BoothType` ADD CONSTRAINT `BoothType_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EventFee` ADD CONSTRAINT `EventFee_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `Event`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Booth` ADD CONSTRAINT `Booth_boothTypeId_fkey` FOREIGN KEY (`boothTypeId`) REFERENCES `BoothType`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
