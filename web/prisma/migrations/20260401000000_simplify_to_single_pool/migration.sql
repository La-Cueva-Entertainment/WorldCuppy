-- This migration assumes a fresh MariaDB/MySQL database.
-- It creates all tables needed by WorldCuppy from scratch.

-- Auth tables (NextAuth / Prisma Adapter)

CREATE TABLE IF NOT EXISTS `User` (
    `id`            VARCHAR(191) NOT NULL,
    `name`          VARCHAR(191),
    `email`         VARCHAR(191) UNIQUE,
    `emailVerified` DATETIME(3),
    `image`         VARCHAR(191),
    `passwordHash`  VARCHAR(191),
    `isAdmin`       BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Account` (
    `id`                VARCHAR(191) NOT NULL,
    `userId`            VARCHAR(191) NOT NULL,
    `type`              VARCHAR(191) NOT NULL,
    `provider`          VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token`     TEXT,
    `access_token`      TEXT,
    `expires_at`        INT,
    `token_type`        VARCHAR(191),
    `scope`             VARCHAR(191),
    `id_token`          TEXT,
    `session_state`     VARCHAR(191),
    PRIMARY KEY (`id`),
    UNIQUE KEY `Account_provider_providerAccountId_key` (`provider`, `providerAccountId`),
    INDEX `Account_userId_idx` (`userId`),
    CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Session` (
    `id`           VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL UNIQUE,
    `userId`       VARCHAR(191) NOT NULL,
    `expires`      DATETIME(3) NOT NULL,
    PRIMARY KEY (`id`),
    INDEX `Session_userId_idx` (`userId`),
    CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token`      VARCHAR(191) NOT NULL UNIQUE,
    `expires`    DATETIME(3) NOT NULL,
    UNIQUE KEY `VerificationToken_identifier_token_key` (`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- App tables

CREATE TABLE IF NOT EXISTS `Tournament` (
    `id`             VARCHAR(191) NOT NULL,
    `name`           VARCHAR(191) NOT NULL,
    `type`           VARCHAR(191) NOT NULL,
    `year`           INT NOT NULL,
    `teamsPerPlayer` INT NOT NULL DEFAULT 4,
    `status`         VARCHAR(191) NOT NULL DEFAULT 'upcoming',
    `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `TournamentDraft` (
    `tournamentId` VARCHAR(191) NOT NULL,
    `status`       VARCHAR(191) NOT NULL DEFAULT 'pending',
    `orderUserIds` JSON NOT NULL,
    `currentPick`  INT NOT NULL DEFAULT 0,
    `updatedAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`tournamentId`),
    INDEX `TournamentDraft_status_idx` (`status`),
    CONSTRAINT `TournamentDraft_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `LineupPick` (
    `id`           VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `userId`       VARCHAR(191) NOT NULL,
    `teamCode`     VARCHAR(191) NOT NULL,
    `draftOdds`    INT,
    `pickNumber`   INT,
    `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    UNIQUE KEY `LineupPick_tournamentId_userId_teamCode_key` (`tournamentId`, `userId`, `teamCode`),
    UNIQUE KEY `LineupPick_tournamentId_pickNumber_key` (`tournamentId`, `pickNumber`),
    INDEX `LineupPick_tournamentId_userId_idx` (`tournamentId`, `userId`),
    INDEX `LineupPick_userId_idx` (`userId`),
    INDEX `LineupPick_tournamentId_idx` (`tournamentId`),
    CONSTRAINT `LineupPick_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `LineupPick_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Match` (
    `id`            VARCHAR(191) NOT NULL,
    `tournamentId`  VARCHAR(191) NOT NULL,
    `stage`         VARCHAR(191) NOT NULL,
    `groupName`     VARCHAR(191),
    `homeTeam`      VARCHAR(191) NOT NULL,
    `awayTeam`      VARCHAR(191) NOT NULL,
    `homeScore`     INT,
    `awayScore`     INT,
    `penaltyWinner` VARCHAR(191),
    `played`        BOOLEAN NOT NULL DEFAULT false,
    `matchDate`     DATETIME(3),
    `createdAt`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `Match_tournamentId_stage_idx` (`tournamentId`, `stage`),
    CONSTRAINT `Match_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `EarningsAdjustment` (
    `id`           VARCHAR(191) NOT NULL,
    `tournamentId` VARCHAR(191) NOT NULL,
    `userId`       VARCHAR(191) NOT NULL,
    `reason`       VARCHAR(191) NOT NULL,
    `amountCents`  INT NOT NULL,
    `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`),
    INDEX `EarningsAdjustment_tournamentId_userId_idx` (`tournamentId`, `userId`),
    CONSTRAINT `EarningsAdjustment_tournamentId_fkey` FOREIGN KEY (`tournamentId`) REFERENCES `Tournament`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `EarningsAdjustment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
