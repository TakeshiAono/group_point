/**
 * シードデータ
 *
 * 実行: npm run db:seed
 *
 * 作成されるデータ:
 * - ユーザー: admin + leader×3 + member×3（合計7名）
 * - グループ: 「テスト自治体」（adminが作成、全員が所属）
 *
 * ログイン情報（パスワードはすべて "password123"）:
 * - admin@example.com    / ADMIN
 * - leader1@example.com  / LEADER
 * - leader2@example.com  / LEADER
 * - leader3@example.com  / LEADER
 * - member1@example.com  / MEMBER
 * - member2@example.com  / MEMBER
 * - member3@example.com  / MEMBER
 */

import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PASSWORD = "password123";

async function main() {
  const hashed = await bcrypt.hash(PASSWORD, 12);

  // ── ユーザー作成 ──────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { name: "管理人 太郎", email: "admin@example.com", password: hashed },
  });

  const leaders = await Promise.all(
    [1, 2, 3].map((i) =>
      prisma.user.upsert({
        where: { email: `leader${i}@example.com` },
        update: {},
        create: { name: `政府官僚 ${i}号`, email: `leader${i}@example.com`, password: hashed },
      })
    )
  );

  const members = await Promise.all(
    [1, 2, 3].map((i) =>
      prisma.user.upsert({
        where: { email: `member${i}@example.com` },
        update: {},
        create: { name: `一般市民 ${i}号`, email: `member${i}@example.com`, password: hashed },
      })
    )
  );

  // ── グループ作成 ──────────────────────────────────────────
  const group = await prisma.group.upsert({
    where: { id: "seed-group-001" },
    update: {},
    create: {
      id: "seed-group-001",
      name: "テスト自治体",
      totalIssuedPoints: 1000,  // ADMINが1000pt発行済み
    },
  });

  // ── メンバー登録 ──────────────────────────────────────────
  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId: admin.id, groupId: group.id } },
    update: {},
    create: { userId: admin.id, groupId: group.id, role: "ADMIN", memberPoints: 0 },
  });

  for (const leader of leaders) {
    await prisma.groupMember.upsert({
      where: { userId_groupId: { userId: leader.id, groupId: group.id } },
      update: {},
      create: { userId: leader.id, groupId: group.id, role: "LEADER", memberPoints: 0 },
    });
  }

  const memberRecords: { id: string }[] = [];
  for (const member of members) {
    const m = await prisma.groupMember.upsert({
      where: { userId_groupId: { userId: member.id, groupId: group.id } },
      update: {},
      create: { userId: member.id, groupId: group.id, role: "MEMBER", memberPoints: 100 },
    });
    memberRecords.push(m);
  }

  // ── クエスト作成 ──────────────────────────────────────────
  const adminMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: admin.id, groupId: group.id } },
  });
  const leaderMembers = await Promise.all(
    leaders.map((l) =>
      prisma.groupMember.findUnique({
        where: { userId_groupId: { userId: l.id, groupId: group.id } },
      })
    )
  );

  // 政府案件
  const govQuests = [
    { title: "道路の補修作業", description: "市内の主要道路のひび割れを修繕してください", pointReward: 200 },
    { title: "公園の清掃活動", description: "市民公園のゴミ拾いと草刈りを行ってください", pointReward: 100 },
    { title: "防災訓練の補助", description: "地域防災訓練のスタッフとして参加してください", pointReward: 150 },
  ];
  for (const q of govQuests) {
    await prisma.quest.create({
      data: { ...q, groupId: group.id, creatorId: adminMember!.id, questType: "GOVERNMENT" },
    });
  }

  // メンバー案件（leader1が発行）
  const memberQuests = [
    { title: "引越しの手伝い", description: "来週末の引越しを手伝ってください", pointReward: 50 },
    { title: "英語の翻訳", description: "書類1枚の日本語→英語翻訳をお願いします", pointReward: 30 },
  ];
  for (const q of memberQuests) {
    await prisma.quest.create({
      data: { ...q, groupId: group.id, creatorId: leaderMembers[0]!.id, questType: "MEMBER" },
    });
    await prisma.groupMember.update({
      where: { id: leaderMembers[0]!.id },
      data: { memberPoints: { decrement: q.pointReward } },
    });
  }

  console.log("✅ シードデータを投入しました");
  console.log("   グループ:", group.name);
  console.log("   ADMIN  :", admin.email);
  console.log("   LEADER :", leaders.map((l) => l.email).join(", "));
  console.log("   MEMBER :", members.map((m) => m.email).join(", "));
  console.log("   政府案件: 3件 / メンバー案件: 2件");
  console.log("   パスワード: password123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
