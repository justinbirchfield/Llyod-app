import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { recentExchanges, saveExchange } from "@/lib/db";
import { runTool, tools } from "@/lib/tools";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const MODEL = process.env.CLAUDE_MODEL ?? "claude-sonnet-5-5";
const MAX_TOOL_ROUNDS = 5;

function systemPrompt(today: string): string {
  return `You are Lloyd, Justin's single assistant. Justin is Operations Principal and incoming owner of Daymont-Souders Insurance Agency in Dayton, Ohio.

How to answer:
- Lead with the answer. Short by default; this is read on a phone.
- Be direct and opinionated. Flag weak assumptions instead of agreeing by default.
- No em dashes in anything Justin might send as an email.
- If you don't know or don't have access to something yet, say so plainly.

What you can see:
- The last few exchanges from the past 12 hours are included as conversation, so follow-ups like "what about the second one" work.
- For anything older, use search_history. Never claim Justin didn't say something without searching first.
- The history log is purged after 12 months. AgencyZoom is the system of record for client data. AgencyZoom access isn't connected yet, so if a client question needs it, say so.

Today is ${today}.`;
}

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const { question } = await req.json().catch(() => ({ question: "" }));
  if (typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "empty question" }, { status: 400 });
  }
  if (question.length > 8000) {
    return NextResponse.json({ error: "question too long" }, { status: 400 });
  }

  const today = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Short-term context. If the DB is down, still answer without it.
  const messages: Anthropic.MessageParam[] = [];
  try {
    for (const ex of await recentExchanges()) {
      messages.push({ role: "user", content: ex.question });
      messages.push({ role: "assistant", content: ex.answer });
    }
  } catch (err) {
    console.error("recent history failed", err);
  }
  messages.push({ role: "user", content: question });

  let answer = "";
  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: systemPrompt(today),
        tools,
        messages,
      });

      const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (msg.stop_reason !== "tool_use" || !toolUses.length || round === MAX_TOOL_ROUNDS) {
        answer = msg.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
        break;
      }

      messages.push({ role: "assistant", content: msg.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        try {
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: await runTool(tu.name, tu.input as Record<string, unknown>),
          });
        } catch (err) {
          console.error(`tool ${tu.name} failed`, err);
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Tool failed: ${err instanceof Error ? err.message : "unknown error"}`,
            is_error: true,
          });
        }
      }
      messages.push({ role: "user", content: results });
    }
  } catch (err) {
    console.error("ask failed", err);
    return NextResponse.json({ error: "Claude call failed. Check the server logs." }, { status: 502 });
  }

  if (!answer) answer = "I didn't get a usable answer back. Try asking again.";

  // Log it. A failed save shouldn't cost Justin the answer, but he should know it won't be searchable.
  try {
    await saveExchange(question, answer);
  } catch (err) {
    console.error("save failed", err);
    answer += "\n\n(Note: this exchange didn't save to history.)";
  }

  return NextResponse.json({ answer });
}
