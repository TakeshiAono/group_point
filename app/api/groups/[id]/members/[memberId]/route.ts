import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// グループからメンバーを外す（LEADERのみ、自分自身は外せない）
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId, memberId } = await params;

  // 操作者がLEADERか確認
  const operator = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!operator || operator.role !== "LEADER") {
    return NextResponse.json({ error: "この操作はLEADERのみ実行できます" }, { status: 403 });
  }

  // 対象メンバーを取得
  const target = await prisma.groupMember.findUnique({
    where: { id: memberId },
  });
  if (!target || target.groupId !== groupId) {
    return NextResponse.json({ error: "メンバーが見つかりません" }, { status: 404 });
  }

  // 自分自身は外せない
  if (target.userId === session.user.id) {
    return NextResponse.json({ error: "自分自身をグループから外すことはできません" }, { status: 400 });
  }

  await prisma.groupMember.delete({ where: { id: memberId } });

  return NextResponse.json({ ok: true });
}
