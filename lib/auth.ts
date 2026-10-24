// Signed session cookie using Web Crypto, so it runs in both middleware and API routes.
// Step 1 uses a single app password. Passkeys replace this once the database exists (step 2).

export const SESSION_COOKIE = "lloyd_session";
export const SESSION_DAYS = 30;

async function hmac(value: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET missing or under 32 chars");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  // btoa instead of Buffer: middleware runs on the Edge runtime, which has no Buffer.
  let bin = "";
  for (const byte of new Uint8Array(sig)) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function createSession(): Promise<string> {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = String(expires);
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  if (Number(payload) < Date.now()) return false;
  return timingSafeEqual(sig, await hmac(payload));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
