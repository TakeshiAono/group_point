import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { s3, BUCKET } from "@/lib/s3";
import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = `avatars/${session.user.id}.jpg`;

  // ファイルが存在するか確認
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    return NextResponse.json({ url: null });
  }

  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return NextResponse.json({ url });
}
