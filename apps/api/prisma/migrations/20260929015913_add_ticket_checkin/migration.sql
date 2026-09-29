-- AlterTable
ALTER TABLE `Ticket` ADD COLUMN `checkedInAt` DATETIME(3) NULL,
    ADD COLUMN `checkedInBy` VARCHAR(191) NULL;
