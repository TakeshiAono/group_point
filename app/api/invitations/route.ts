import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 自分宛の招待一覧を取得
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const invitations = await prisma.invitation.findMany({
    where: { inviteeId: session.user.id, status: "PENDING" },
    include: {
      group: { select: { id: true, name: true } },
      inviter: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invitations);
}
