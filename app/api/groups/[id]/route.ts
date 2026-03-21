import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 政府発行済みポイントを更新（ADMINのみ）
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { id: groupId } = await params;
  const { totalIssuedPoints } = await req.json();

  if (typeof totalIssuedPoints !== "number" || totalIssuedPoints < 0 || !Number.isInteger(totalIssuedPoints)) {
    return NextResponse.json({ error: "発行量は0以上の整数で指定してください" }, { status: 400 });
  }

  // ADMINのみ操作可能
  const operator = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId: session.user.id, groupId } },
  });
  if (!operator || operator.role !== "ADMIN") {
    return NextResponse.json({ error: "ポイント発行はADMINのみ実行できます" }, { status: 403 });
  }

  // 現在の流通ポイント合計を計算（発行量はこれを下回れない）
  const members = await prisma.groupMember.findMany({ where: { groupId } });
  const totalCirculating = members.reduce((sum, m) => sum + m.memberPoints, 0);

  if (totalIssuedPoints < totalCirculating) {
    return NextResponse.json(
      { error: `発行量を流通ポイント（${totalCirculating} pt）より少なくすることはできません` },
      { status: 400 }
    );
  }

  const group = await prisma.group.update({
    where: { id: groupId },
    data: { totalIssuedPoints },
  });

  return NextResponse.json(group);
}
