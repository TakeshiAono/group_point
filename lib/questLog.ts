import { prisma } from "@/lib/prisma";

export async function addQuestLog({
  questId,
  memberId,
  action,
  detail,
}: {
  questId: string;
  memberId?: string | null;
  action: string;
  detail: string;
}) {
  await prisma.$executeRaw`
    INSERT INTO "QuestLog" (id, "questId", "memberId", action, detail, "createdAt")
    VALUES (gen_random_uuid()::text, ${questId}, ${memberId ?? null}, ${action}, ${detail}, NOW())
  `;
}
