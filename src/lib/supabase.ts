import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TABLE = "ghl_cache";
const PREFIX = "xle:";

export async function cacheGet<T = unknown>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("data, expires_at")
    .eq("cache_key", PREFIX + key)
    .single();

  if (error || !data) return null;

  if (new Date(data.expires_at) < new Date()) return null;

  return data.data as T;
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const expiresAt = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

  await supabase.from(TABLE).upsert(
    {
      cache_key: PREFIX + key,
      data: value,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" }
  );
}

export async function cacheSyncLog(date: string, results: unknown): Promise<void> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await supabase.from(TABLE).upsert(
    {
      cache_key: `${PREFIX}sync_log:${date}`,
      data: results,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" }
  );
}
