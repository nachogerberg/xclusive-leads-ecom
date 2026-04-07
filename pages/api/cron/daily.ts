import type { NextApiRequest, NextApiResponse } from "next";
import { cacheSet } from "@/src/lib/supabase";
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
    const ranges = ["7d", "30d", "90d"];
    await Promise.all(
      ranges.map(async (range) => {
        const payload = await buildPayload(range);
        await cacheSet(`dashboard:${range}`, payload);
      })
    );

    return res.status(200).json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
