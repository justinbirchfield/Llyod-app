import type Anthropic from "@anthropic-ai/sdk";
import { searchExchanges } from "./db";

// Every capability Lloyd has is a tool registered here. Agenda, email, and AgencyZoom get added in later steps.

export const tools: Anthropic.Tool[] = [
  {
    name: "search_history",
    description:
      "Search everything Justin has asked Lloyd and Lloyd's answers, from the last 12 months (older entries are purged). " +
      "Use when Justin asks what he said, asked, or decided before, or refers to something from an earlier conversation that isn't in the recent context. " +
      "Query is keyword search, not semantic: pass 1-4 distinctive words (names, carriers, topics). " +
      "Words are ANDed by default; use 'or' between alternatives (e.g. 'Smith or Smyth renewal'). " +
      "If nothing comes back, retry once with fewer or different words before saying you found nothing.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Keywords to search for" },
        since: { type: "string", description: "Optional ISO date, only entries on or after this" },
        until: { type: "string", description: "Optional ISO date, only entries before this" },
        max_results: { type: "integer", description: "Default 8, max 20" },
      },
      required: ["query"],
    },
  },
];

type ToolInput = Record<string, unknown>;

export async function runTool(name: string, input: ToolInput): Promise<string> {
  switch (name) {
    case "search_history": {
      const rows = await searchExchanges({
        query: String(input.query ?? ""),
        since: input.since ? String(input.since) : undefined,
        until: input.until ? String(input.until) : undefined,
        max_results: input.max_results ? Number(input.max_results) : undefined,
      });
      if (!rows.length) return "No matches.";
      return rows
        .map((r) => {
          const when = new Date(r.created_at).toLocaleString("en-US", { timeZone: "America/New_York" });
          return `[${when}]\nQ: ${r.question}\nA: ${r.answer}`;
        })
        .join("\n\n---\n\n");
    }
    default:
      return `Unknown tool: ${name}`;
  }
}
