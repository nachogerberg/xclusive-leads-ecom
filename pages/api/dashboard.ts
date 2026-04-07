import type { NextApiRequest, NextApiResponse } from "next";
import { cacheGet } from "@/src/lib/supabase";
import { buildPayload, type DashboardPayload } from "@/src/lib/buildPayload";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const range = (req.query.range as string) || "30d";
  const cacheKey = `dashboard:${range}`;

  // Try cache first
  const cached = await cacheGet<DashboardPayload>(cacheKey);
  if (cached) {
    return res.status(200).json({ source: "cache", ...cached });
  }

  // Fetch live
  const payload = await buildPayload(range);
  return res.status(200).json({ source: "live", ...payload });
}
