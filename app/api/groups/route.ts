import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// グループ一覧取得
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    where: { members: { some: { userId: session.user.id } } },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const response = groups.map((group) => {
    const myMember = group.members.find((m) => m.user.id === session.user!.id);
    const isPrivileged = myMember?.role === "ADMIN" || myMember?.role === "LEADER";
    if (isPrivileged) return group;
    // MEMBERには発行済みポイント情報を返さない
    const { totalIssuedPoints: _, ...rest } = group;
    return rest;
  });

  return NextResponse.json(response);
}

// グループ作成（作成者がADMINになる）
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です（再ログインしてください）" }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "グループ名は必須です" }, { status: 400 });
  }

  const group = await prisma.group.create({
    data: {
      name: name.trim(),
      members: {
        create: {
          userId: session.user.id,
          role: "ADMIN",
        },
      },
    },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  return NextResponse.json(group, { status: 201 });
}
