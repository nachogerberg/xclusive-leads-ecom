import type { NextApiRequest, NextApiResponse } from "next";
import { cacheSet } from "@/src/lib/supabase";
import { buildPayload } from "@/src/lib/buildPayload";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const range = (req.body?.range as string) || "30d";

  try {
    const payload = await buildPayload(range);
    const cacheKey = `dashboard:${range}`;
    await cacheSet(cacheKey, payload);

    return res.status(200).json({ ok: true, syncedAt: payload.syncedAt, range });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
}
