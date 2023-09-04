-- CreateTable
CREATE TABLE `Link` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `url` LONGTEXT NOT NULL,
    `archived` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NULL,
    `title` VARCHAR(191) NULL,
    `description` VARCHAR(280) NULL,
    `image` LONGTEXT NULL,
    `userId` VARCHAR(191) NULL,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Link_createdAt_idx`(`createdAt` DESC),
    INDEX `Link_clicks_idx`(`clicks` DESC),
    INDEX `Link_userId_idx`(`userId`),
    UNIQUE INDEX `Link_key_key`(`key`),
    FULLTEXT INDEX `Link_key_url_idx`(`key`, `url`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Link` ADD CONSTRAINT `Link_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
