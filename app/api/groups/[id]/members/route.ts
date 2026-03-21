import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// グループにメンバーを追加（LEADERのみ操作可能）
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const { email, role } = await req.json();

  if (!email?.trim()) {
    return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });
  }
  if (role !== "LEADER" && role !== "MEMBER") {
    return NextResponse.json({ error: "roleはLEADERまたはMEMBERを指定してください" }, { status: 400 });
  }

  // 操作者がそのグループのLEADERか確認
  const operatorMember = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!operatorMember || operatorMember.role !== "LEADER") {
    return NextResponse.json({ error: "この操作はLEADERのみ実行できます" }, { status: 403 });
  }

  // 追加対象ユーザーをメールアドレスで検索
  const targetUser = await prisma.user.findUnique({ where: { email: email.trim() } });
  if (!targetUser) {
    return NextResponse.json({ error: "指定されたメールアドレスのユーザーが見つかりません" }, { status: 404 });
  }

  // すでにメンバーの場合はロールを更新
  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: targetUser.id, groupId } },
  });

  if (existing) {
    const updated = await prisma.groupMember.update({
      where: { id: existing.id },
      data: { role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    return NextResponse.json(updated);
  }

  const member = await prisma.groupMember.create({
    data: { userId: targetUser.id, groupId, role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  return NextResponse.json(member, { status: 201 });
}
