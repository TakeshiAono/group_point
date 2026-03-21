import { auth } from "@/auth";
import { redirect } from "next/navigation";
import InvitationList from "@/app/InvitationList";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-gray-800 mb-1">
          ようこそ、{session.user?.name ?? session.user?.email} さん
        </h2>
        <p className="text-gray-500 text-sm">左のサイドバーからグループを選択してください。</p>
      </div>
      <InvitationList />
    </div>
  );
}
