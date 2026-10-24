import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/auth";

// Simple brute-force brake: one attempt per second per server instance.
let lastAttempt = 0;

export async function POST(req: NextRequest) {
  const now = Date.now();
  if (now - lastAttempt < 1000) {
    return NextResponse.json({ error: "slow down" }, { status: 429 });
  }
  lastAttempt = now;

  const { password } = await req.json().catch(() => ({ password: "" }));
  const expected = process.env.APP_PASSWORD;
  if (!expected || password !== expected) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(), {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
