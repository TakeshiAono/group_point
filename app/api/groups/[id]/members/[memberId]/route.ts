import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 権限テーブル
// ADMIN  → LEADER・MEMBERを削除可能
// LEADER → MEMBERのみ削除可能
// MEMBER → 削除不可
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, memberId } = await params;

  // 操作者のロールを確認
  const operator = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!operator || operator.role === "MEMBER") {
    return NextResponse.json({ error: "削除できる権限がありません" }, { status: 403 });
  }

  // 対象メンバーを取得
  const target = await prisma.groupMember.findUnique({
    where: { id: memberId },
  });
  if (!target || target.groupId !== groupId) {
    return NextResponse.json({ error: "メンバーが見つかりません" }, { status: 404 });
  }

  // 自分自身は削除不可
  if (target.userId === session.user.id) {
    return NextResponse.json({ error: "自分自身を削除することはできません" }, { status: 400 });
  }

  // LEADERはADMIN・LEADERを削除不可
  if (operator.role === "LEADER" && target.role !== "MEMBER") {
    return NextResponse.json({ error: "政府関係者・管理人の削除はADMINのみ実行できます" }, { status: 403 });
  }

  // ADMINは削除不可（グループに必ず1人は必要）
  if (target.role === "ADMIN") {
    return NextResponse.json({ error: "管理人を削除することはできません" }, { status: 400 });
  }

  await prisma.groupMember.delete({ where: { id: memberId } });

  return NextResponse.json({ ok: true });
}
