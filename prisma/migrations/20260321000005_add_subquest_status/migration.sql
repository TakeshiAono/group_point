-- CreateEnum
CREATE TYPE "SubQuestStatus" AS ENUM ('REQUESTED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable: SubQuest.statusをSubQuestStatus型に変更し、既存データはREQUESTEDに移行
ALTER TABLE "SubQuest" ADD COLUMN "status_new" "SubQuestStatus" NOT NULL DEFAULT 'REQUESTED';
UPDATE "SubQuest" SET "status_new" = CASE
  WHEN "status"::text = 'OPEN' THEN 'REQUESTED'::"SubQuestStatus"
  WHEN "status"::text = 'IN_PROGRESS' THEN 'IN_PROGRESS'::"SubQuestStatus"
  WHEN "status"::text = 'COMPLETED' THEN 'COMPLETED'::"SubQuestStatus"
  WHEN "status"::text = 'CANCELLED' THEN 'CANCELLED'::"SubQuestStatus"
  ELSE 'REQUESTED'::"SubQuestStatus"
END;
ALTER TABLE "SubQuest" DROP COLUMN "status";
ALTER TABLE "SubQuest" RENAME COLUMN "status_new" TO "status";
