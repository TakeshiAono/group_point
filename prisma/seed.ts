/**
 * シードデータ
 *
 * 実行: npm run db:seed
 *
 * 作成されるデータ:
 * - ユーザー: admin + leader×3 + member×3（合計7名）
 * - グループ: 「テスト自治体」（adminが作成、全員が所属）
 * - クエスト: 過去6ヶ月分（2025-10〜2026-03）の管理側・メンバー案件
 * - クエスト提案: 各月にランダムで分散
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
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

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
        create: { name: `管理官僚 ${i}号`, email: `leader${i}@example.com`, password: hashed },
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
    update: { totalIssuedPoints: 3000 },
    create: {
      id: "seed-group-001",
      name: "テスト自治体",
      totalIssuedPoints: 3000,
    },
  });

  // ── メンバー登録 ──────────────────────────────────────────
  // 最終的なmemberPointsを直接設定（イベントから逆算して整合）
  // member1: GOV完了 680pt + MEMBER完了 95pt - MEMBER作成 30pt = 745
  // member2: GOV完了 530pt + MEMBER完了 40pt - MEMBER作成 35pt = 535
  // member3: GOV完了 300pt + MEMBER完了 80pt = 380
  // leader1: 初期200pt - MEMBER作成 110pt = 90
  // leader2: 初期200pt - MEMBER作成 85pt = 115
  // leader3: 初期100pt（変動なし）
  await prisma.groupMember.upsert({
    where: { userId_groupId: { userId: admin.id, groupId: group.id } },
    update: { memberPoints: 0 },
    create: { userId: admin.id, groupId: group.id, role: "ADMIN", memberPoints: 0 },
  });
  const leaderPoints = [90, 115, 100];
  const leaderMembers = await Promise.all(
    leaders.map((l, i) =>
      prisma.groupMember.upsert({
        where: { userId_groupId: { userId: l.id, groupId: group.id } },
        update: { memberPoints: leaderPoints[i] },
        create: { userId: l.id, groupId: group.id, role: "LEADER", memberPoints: leaderPoints[i] },
      })
    )
  );
  const memberPoints = [745, 535, 380];
  const memberRecords = await Promise.all(
    members.map((m, i) =>
      prisma.groupMember.upsert({
        where: { userId_groupId: { userId: m.id, groupId: group.id } },
        update: { memberPoints: memberPoints[i] },
        create: { userId: m.id, groupId: group.id, role: "MEMBER", memberPoints: memberPoints[i] },
      })
    )
  );

  const [leader1, leader2] = leaderMembers;
  const [member1, member2, member3] = memberRecords;

  // ── 既存クエスト・提案を削除してリセット ──────────────────
  await prisma.questLog.deleteMany({ where: { quest: { groupId: group.id } } });
  await prisma.subQuest.deleteMany({ where: { quest: { groupId: group.id } } });
  await prisma.quest.deleteMany({ where: { groupId: group.id } });
  await prisma.questProposal.deleteMany({ where: { groupId: group.id } });

  // ── 管理側クエスト（GOVERNMENT） ─────────────────────────
  type GovQuestDef = {
    title: string; description: string; pointReward: number;
    createdAt: Date; completedAt: Date; completerId: string;
    status?: "COMPLETED" | "IN_PROGRESS" | "OPEN";
  };

  const govQuests: GovQuestDef[] = [
    // 2025-10
    { title: "秋の地域清掃", description: "市内公園・歩道の落ち葉清掃と草刈りを行ってください", pointReward: 100, createdAt: d(2025,10,1), completedAt: d(2025,10,15), completerId: member1.id },
    { title: "防犯パトロール補助", description: "夜間の防犯パトロールスタッフとして参加してください", pointReward: 80, createdAt: d(2025,10,5), completedAt: d(2025,10,20), completerId: member2.id },
    // 2025-11
    { title: "防災マップ作成支援", description: "地域防災マップのデータ収集・整理を手伝ってください", pointReward: 200, createdAt: d(2025,11,1), completedAt: d(2025,11,10), completerId: member1.id },
    { title: "道路点検業務補助", description: "市内道路の損傷箇所を巡回・記録してください", pointReward: 150, createdAt: d(2025,11,5), completedAt: d(2025,11,20), completerId: member2.id },
    // 2025-12
    { title: "年末大掃除補助", description: "市役所周辺の年末大掃除を手伝ってください", pointReward: 100, createdAt: d(2025,12,1), completedAt: d(2025,12,10), completerId: member3.id },
    { title: "イルミネーション設置", description: "駅前広場のイルミネーション設置作業をお願いします", pointReward: 180, createdAt: d(2025,12,5), completedAt: d(2025,12,20), completerId: member1.id },
    // 2026-01
    { title: "新春祭り準備", description: "新年祭りの会場設営・受付補助をお願いします", pointReward: 150, createdAt: d(2026,1,2), completedAt: d(2026,1,12), completerId: member2.id },
    { title: "雪かき支援", description: "高齢者宅の雪かき作業を手伝ってください", pointReward: 80, createdAt: d(2026,1,8), completedAt: d(2026,1,20), completerId: member3.id },
    // 2026-02
    { title: "公園整備作業", description: "中央公園のベンチ修繕と植栽整備を行ってください", pointReward: 200, createdAt: d(2026,2,1), completedAt: d(2026,2,15), completerId: member1.id },
    { title: "高齢者見守り活動", description: "一人暮らし高齢者への訪問見守り活動に参加してください", pointReward: 120, createdAt: d(2026,2,5), completedAt: d(2026,2,20), completerId: member3.id },
    // 2026-03
    { title: "桜まつり準備", description: "桜まつりの会場設営・案内板設置をお願いします", pointReward: 150, createdAt: d(2026,3,1), completedAt: d(2026,3,10), completerId: member2.id },
    { title: "春の交通安全活動", description: "小学校周辺の登下校見守り活動に参加してください", pointReward: 100, createdAt: d(2026,3,5), completedAt: d(2026,3,5), completerId: member3.id, status: "IN_PROGRESS" },
  ];

  for (const q of govQuests) {
    const status = q.status ?? "COMPLETED";
    const quest = await prisma.quest.create({
      data: {
        groupId: group.id,
        creatorId: leader1.id,
        title: q.title,
        description: q.description,
        pointReward: q.pointReward,
        questType: "GOVERNMENT",
        status,
        completerId: status === "COMPLETED" ? q.completerId : null,
        actualPaidPoints: status === "COMPLETED" ? q.pointReward : null,
        createdAt: q.createdAt,
      },
    });
    if (status === "COMPLETED") {
      await prisma.questLog.create({
        data: {
          questId: quest.id,
          memberId: q.completerId,
          action: "COMPLETED",
          detail: "クエストが完了しました",
          createdAt: q.completedAt,
        },
      });
    } else if (status === "IN_PROGRESS") {
      await prisma.questLog.create({
        data: {
          questId: quest.id,
          memberId: q.completerId,
          action: "ACCEPTED",
          detail: "クエストを受注しました",
          createdAt: q.completedAt,
        },
      });
    }
  }

  // ── メンバー案件（MEMBER） ────────────────────────────────
  type MemberQuestDef = {
    title: string; description: string; pointReward: number;
    creatorId: string; completerId: string | null;
    createdAt: Date; completedAt: Date | null;
    status: "COMPLETED" | "OPEN";
  };

  const memberQuests: MemberQuestDef[] = [
    { title: "引越し荷物運び", description: "来週末の引越しを手伝ってください", pointReward: 50, creatorId: leader1.id, completerId: member3.id, createdAt: d(2025,10,8), completedAt: d(2025,10,25), status: "COMPLETED" },
    { title: "資料の翻訳作業", description: "英語書類1枚の翻訳をお願いします（A4 1枚）", pointReward: 30, creatorId: member1.id, completerId: member3.id, createdAt: d(2025,11,12), completedAt: d(2025,11,28), status: "COMPLETED" },
    { title: "書類整理の手伝い", description: "年末の書類整理・ファイリングを手伝ってください", pointReward: 40, creatorId: leader2.id, completerId: member2.id, createdAt: d(2025,12,8), completedAt: d(2025,12,18), status: "COMPLETED" },
    { title: "ペット預かり", description: "旅行中の犬（小型犬）を2泊3日預かってください", pointReward: 60, creatorId: leader1.id, completerId: member1.id, createdAt: d(2026,1,5), completedAt: d(2026,1,25), status: "COMPLETED" },
    { title: "写真撮影・編集", description: "地域イベントの写真撮影と簡単な編集をお願いします", pointReward: 35, creatorId: member2.id, completerId: member1.id, createdAt: d(2026,2,8), completedAt: d(2026,2,25), status: "COMPLETED" },
    { title: "草刈り作業", description: "自宅裏の草刈りを手伝ってください（2時間程度）", pointReward: 45, creatorId: leader2.id, completerId: null, createdAt: d(2026,3,8), completedAt: null, status: "OPEN" },
  ];

  for (const q of memberQuests) {
    const quest = await prisma.quest.create({
      data: {
        groupId: group.id,
        creatorId: q.creatorId,
        title: q.title,
        description: q.description,
        pointReward: q.pointReward,
        questType: "MEMBER",
        status: q.status,
        completerId: q.completerId,
        actualPaidPoints: q.status === "COMPLETED" ? q.pointReward : null,
        createdAt: q.createdAt,
      },
    });
    if (q.status === "COMPLETED" && q.completerId && q.completedAt) {
      await prisma.questLog.create({
        data: {
          questId: quest.id,
          memberId: q.completerId,
          action: "COMPLETED",
          detail: "クエストが完了しました",
          createdAt: q.completedAt,
        },
      });
    }
  }

  // ── クエスト提案 ──────────────────────────────────────────
  const proposals = [
    { proposerId: member1.id, title: "駅前Wi-Fi設置", description: "駅前の待合スペースにWi-Fiを整備してほしいです", pointReward: 200, status: "APPROVED", createdAt: d(2025,10,5) },
    { proposerId: member2.id, title: "バリアフリー歩道改修", description: "段差が多く車椅子ユーザーが通りづらい歩道の改修をお願いします", pointReward: 300, status: "REJECTED", createdAt: d(2025,11,8) },
    { proposerId: member3.id, title: "農業体験イベント開催", description: "子どもたちに農業を体験させるイベントを企画してほしいです", pointReward: 120, status: "PENDING", createdAt: d(2025,12,12) },
    { proposerId: member1.id, title: "夜間防犯パトロール強化", description: "夜間のパトロール回数を増やしてほしいです", pointReward: 150, status: "APPROVED", createdAt: d(2026,1,8) },
    { proposerId: member2.id, title: "コミュニティバス導入", description: "高齢者が多い地区にコミュニティバスを運行してほしいです", pointReward: 500, status: "PENDING", createdAt: d(2026,1,20) },
    { proposerId: member3.id, title: "防犯カメラ増設", description: "商店街の防犯カメラが少ないため増設をお願いします", pointReward: 250, status: "REJECTED", createdAt: d(2026,2,10) },
    { proposerId: member1.id, title: "スポーツ教室の定期開催", description: "子ども向けのスポーツ教室を毎月開催してほしいです", pointReward: 100, status: "PENDING", createdAt: d(2026,2,25) },
    { proposerId: member2.id, title: "図書館の開館時間延長", description: "平日夜間も利用できるよう延長をお願いします", pointReward: 80, status: "PENDING", createdAt: d(2026,3,5) },
    { proposerId: member3.id, title: "子どもの遊び場整備", description: "住宅地内に安全な遊び場を整備してほしいです", pointReward: 200, status: "PENDING", createdAt: d(2026,3,15) },
  ];

  for (const p of proposals) {
    await prisma.questProposal.create({
      data: {
        groupId: group.id,
        proposerId: p.proposerId,
        title: p.title,
        description: p.description,
        pointReward: p.pointReward,
        status: p.status as "PENDING" | "APPROVED" | "REJECTED",
        createdAt: p.createdAt,
      },
    });
  }

  console.log("✅ シードデータを投入しました");
  console.log("   グループ:", group.name, "/ 発行ポイント: 3000pt");
  console.log("   ADMIN  :", admin.email);
  console.log("   LEADER :", leaders.map((l) => l.email).join(", "));
  console.log("   MEMBER :", members.map((m) => m.email).join(", "));
  console.log("   管理側案件: 12件 / メンバー案件: 6件 / クエスト提案: 9件（6ヶ月分）");
  console.log("   パスワード: password123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
