/*
  Warnings:

  - You are about to drop the column `groupId` on the `BonusRule` table. All the data in the column will be lost.
  - Added the required column `questId` to the `BonusRule` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "QuestProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "BonusRule" DROP CONSTRAINT "BonusRule_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Quest" DROP CONSTRAINT "Quest_creatorId_fkey";

-- DropIndex
DROP INDEX "BonusRule_groupId_idx";

-- AlterTable
ALTER TABLE "BonusRule" DROP COLUMN "groupId",
ADD COLUMN     "questId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Group" ADD COLUMN     "proposalReward" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Quest" ADD COLUMN     "actualPaidPoints" INTEGER;

-- AlterTable
ALTER TABLE "SubQuest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "QuestLog" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "memberId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestProposal" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pointReward" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" "QuestProposalStatus" NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "questId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestProposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestLog_questId_idx" ON "QuestLog"("questId");

-- CreateIndex
CREATE INDEX "QuestProposal_groupId_idx" ON "QuestProposal"("groupId");

-- CreateIndex
CREATE INDEX "BonusRule_questId_idx" ON "BonusRule"("questId");

-- AddForeignKey
ALTER TABLE "QuestLog" ADD CONSTRAINT "QuestLog_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestLog" ADD CONSTRAINT "QuestLog_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GroupMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonusRule" ADD CONSTRAINT "BonusRule_questId_fkey" FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProposal" ADD CONSTRAINT "QuestProposal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestProposal" ADD CONSTRAINT "QuestProposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "GroupMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
