import type { NextApiRequest, NextApiResponse } from "next";
import { cacheSet, cacheSyncLog } from "@/src/lib/supabase";
import { buildPayload } from "@/src/lib/buildPayload";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const ranges = ["7d", "30d", "90d"] as const;
    const results = await Promise.all(
      ranges.map(async (range) => {
        const payload = await buildPayload(range);
        await cacheSet(`dashboard:${range}`, payload);
        return { range, syncedAt: payload.syncedAt, meta: payload.meta.status, shopify: payload.shopify.status, ghl: payload.ghl.status };
      })
    );

    const completedAt = new Date().toISOString();
    const today = completedAt.slice(0, 10);
    await cacheSyncLog(today, { ranges: [...ranges], results, completedAt });

    return res.status(200).json({ ok: true, syncedAt: completedAt, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
