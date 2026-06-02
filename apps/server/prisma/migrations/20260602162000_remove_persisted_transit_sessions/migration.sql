-- DropForeignKey
ALTER TABLE "FileChangeEvent" DROP CONSTRAINT "FileChangeEvent_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "SessionMessage" DROP CONSTRAINT "SessionMessage_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "TerminalOutputChunk" DROP CONSTRAINT "TerminalOutputChunk_sessionId_fkey";

-- DropTable
DROP TABLE "FileChangeEvent";

-- DropTable
DROP TABLE "SessionMessage";

-- DropTable
DROP TABLE "TerminalOutputChunk";

-- DropTable
DROP TABLE "Session";

-- DropEnum
DROP TYPE "FileChangeType";

-- DropEnum
DROP TYPE "OutputStream";

-- DropEnum
DROP TYPE "SessionStatus";
