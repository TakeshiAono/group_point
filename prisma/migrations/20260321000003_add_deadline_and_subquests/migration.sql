-- Quest に deadline カラムを追加
ALTER TABLE "Quest" ADD COLUMN "deadline" TIMESTAMP(3);

-- SubQuest テーブルを作成
CREATE TABLE "SubQuest" (
    "id" TEXT NOT NULL,
    "questId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assigneeId" TEXT,
    "status" "QuestStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubQuest_pkey" PRIMARY KEY ("id")
);

-- 外部キー制約
ALTER TABLE "SubQuest" ADD CONSTRAINT "SubQuest_questId_fkey"
    FOREIGN KEY ("questId") REFERENCES "Quest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubQuest" ADD CONSTRAINT "SubQuest_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "GroupMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
