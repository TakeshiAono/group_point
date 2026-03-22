"use client";

import { useEffect, useState } from "react";

type Props = {
  userId: string | undefined;
  name: string | null;
  size?: "sm" | "md";
};

export default function UserAvatar({ userId, name, size = "sm" }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/avatar/download-url?userId=${userId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.url) setUrl(d.url); })
      .catch(() => {});
  }, [userId]);

  const sizeClass = size === "md" ? "w-10 h-10 text-base" : "w-7 h-7 text-xs";
  const initial = name ? name.charAt(0).toUpperCase() : "?";

  return (
    <div className={`${sizeClass} rounded-full overflow-hidden shrink-0`}>
      {url ? (
        <img
          src={url}
          alt={name ?? ""}
          className="w-full h-full object-cover"
          onError={() => setUrl(null)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4/5 h-4/5 text-gray-400">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
          </svg>
        </div>
      )}
    </div>
  );
}
