import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { s3, BUCKET } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const key = `avatars/${session.user.id}.jpg`;
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: "image/jpeg",
  });

  const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5分

  return NextResponse.json({ url, key });
}
