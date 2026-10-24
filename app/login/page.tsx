"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) window.location.href = "/";
    else setError((await res.json()).error ?? "Login failed");
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        <button type="submit">Unlock</button>
        {error && <div className="error">{error}</div>}
      </form>
    </main>
  );
}
