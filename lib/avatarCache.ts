// メモリキャッシュ（ページリロードまで保持）
const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export async function fetchAvatarUrl(userId: string): Promise<string | null> {
  if (cache.has(userId)) return cache.get(userId)!;

  // 同じuserIdへの同時リクエストをまとめる
  if (inflight.has(userId)) return inflight.get(userId)!;

  const promise = fetch(`/api/avatar/download-url?userId=${userId}`)
    .then((r) => r.ok ? r.json() : null)
    .then((d) => {
      const url = d?.url ?? null;
      cache.set(userId, url);
      inflight.delete(userId);
      return url;
    })
    .catch(() => {
      inflight.delete(userId);
      return null;
    });

  inflight.set(userId, promise);
  return promise;
}
