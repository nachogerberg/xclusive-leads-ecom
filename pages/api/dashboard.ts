import type { NextApiRequest, NextApiResponse } from "next";
import { cacheGet, cacheSet } from "@/src/lib/supabase";
import { buildPayload, type DashboardPayload } from "@/src/lib/buildPayload";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const range = (req.query.range as string) || "30d";
  const cacheKey = `dashboard:${range}`;
  const isCustom = range.startsWith("custom:");

  // Try cache first (skip for custom date ranges — always fetch live)
  if (!isCustom) {
    const cached = await cacheGet<DashboardPayload>(cacheKey);
    if (cached) {
      return res.status(200).json({ source: "cache", ...cached });
    }
  }

  // Fetch live + save to cache (skip cache write for custom ranges)
  const payload = await buildPayload(range);
  if (!isCustom) await cacheSet(cacheKey, payload);
  return res.status(200).json({ source: "live", ...payload });
}
