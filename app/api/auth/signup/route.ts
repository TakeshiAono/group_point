import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードは必須です" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "このメールアドレスはすでに登録されています" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
    });

    // このメールアドレス宛のpending招待をユーザーに紐づける
    await prisma.invitation.updateMany({
      where: { inviteeEmail: email.toLowerCase(), inviteeId: null, status: "PENDING" },
      data: { inviteeId: user.id },
    });

    return NextResponse.json({ message: "アカウントを作成しました" }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
