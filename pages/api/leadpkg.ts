import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

const TABLE_CANDIDATES = ["lead_packages", "leadpkgs", "leadpkg_data"];

async function findTable(): Promise<string | null> {
  for (const table of TABLE_CANDIDATES) {
    const { error } = await supabase.from(table).select("*").limit(1);
    if (!error) return table;
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tableName = await findTable();
    if (!tableName) {
      return res.status(200).json({
        data: [],
        error: `No table found. Tried: ${TABLE_CANDIDATES.join(", ")}. Please create one of these tables in Supabase.`,
      });
    }

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .eq("year", 2026)
      .ilike("type_of_service", "PPL")
      .order("mes", { ascending: true })
      .order("campaign_name", { ascending: true });

    if (error) {
      return res.status(200).json({ data: [], error: error.message });
    }

    return res.status(200).json({ data: data || [], error: null });
  } catch (e) {
    return res.status(200).json({ data: [], error: String(e) });
  }
}
