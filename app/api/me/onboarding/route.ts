import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { onboardingCompleted: true },
  });

  return NextResponse.json({ ok: true });
}
