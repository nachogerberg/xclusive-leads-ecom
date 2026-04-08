import type { NextApiRequest, NextApiResponse } from "next";
import { cacheSet } from "@/src/lib/supabase";
import { buildPayload } from "@/src/lib/buildPayload";

const ALL_RANGES = ["7d", "30d", "90d"];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const range = req.body?.range as string | undefined;

  try {
    // If a specific valid range is given, sync only that range
    if (range && ALL_RANGES.includes(range)) {
      const payload = await buildPayload(range);
      await cacheSet(`dashboard:${range}`, payload);
      return res.status(200).json({
        ok: true,
        synced: [{ range, syncedAt: payload.syncedAt, meta: payload.meta.status, shopify: payload.shopify.status, ghl: payload.ghl.status }],
      });
    }

    // Otherwise sync all ranges in parallel
    const results = await Promise.all(
      ALL_RANGES.map(async (r) => {
        const payload = await buildPayload(r);
        await cacheSet(`dashboard:${r}`, payload);
        return { range: r, syncedAt: payload.syncedAt, meta: payload.meta.status, shopify: payload.shopify.status, ghl: payload.ghl.status };
      })
    );

    return res.status(200).json({ ok: true, synced: results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
