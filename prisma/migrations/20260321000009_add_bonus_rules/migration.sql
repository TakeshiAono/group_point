-- CreateTable
CREATE TABLE "BonusRule" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "thresholdPercent" DOUBLE PRECISION NOT NULL,
    "bonusRate" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BonusRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BonusRule_groupId_idx" ON "BonusRule"("groupId");

-- AddForeignKey
ALTER TABLE "BonusRule" ADD CONSTRAINT "BonusRule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
