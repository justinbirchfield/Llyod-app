import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only. The service-role key bypasses RLS, so it must never reach the browser.
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

export type Exchange = { created_at: string; question: string; answer: string };

// Recent exchanges for short-term context, oldest first.
export async function recentExchanges(hours = 12, limit = 8): Promise<Exchange[]> {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data, error } = await db()
    .from("exchanges")
    .select("created_at, question, answer")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function saveExchange(question: string, answer: string): Promise<void> {
  const { error } = await db().from("exchanges").insert({ question, answer });
  if (error) throw error;
}

export async function searchExchanges(args: {
  query: string;
  since?: string;
  until?: string;
  max_results?: number;
}): Promise<(Exchange & { rank: number })[]> {
  const { data, error } = await db().rpc("search_exchanges", {
    q: args.query,
    since: args.since ?? null,
    until: args.until ?? null,
    max_results: args.max_results ?? 8,
  });
  if (error) throw error;
  return data ?? [];
}
