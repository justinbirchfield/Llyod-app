"use client";

import { useEffect, useRef, useState } from "react";

type State =
  | { kind: "idle" }
  | { kind: "thinking"; question: string }
  | { kind: "answer"; question: string; text: string }
  | { kind: "error"; question: string; text: string };

// Voice input is the phone keyboard's dictation mic. No custom speech code.
export default function Home() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [input]);

  async function ask() {
    const question = input.trim();
    if (!question || state.kind === "thinking") return;
    setState({ kind: "thinking", question });
    setInput("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setState({ kind: "answer", question, text: data.answer });
    } catch (e: any) {
      setState({ kind: "error", question, text: e.message ?? "Something went wrong" });
    }
  }

  return (
    <main className="shell">
      <section className={`answer ${state.kind === "idle" ? "empty" : ""}`}>
        {state.kind === "idle" && <span>Ask anything.</span>}
        {state.kind !== "idle" && <div className="asked">{state.question}</div>}
        {state.kind === "thinking" && <div className="thinking">Thinking…</div>}
        {state.kind === "answer" && <div>{state.text}</div>}
        {state.kind === "error" && <div className="error">{state.text}</div>}
      </section>

      <form
        className="bar"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <textarea
          ref={taRef}
          rows={1}
          value={input}
          placeholder="Ask Lloyd"
          enterKeyHint="send"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask();
            }
          }}
        />
        <button
          type="submit"
          className="btn send"
          disabled={!input.trim() || state.kind === "thinking"}
          aria-label="Ask"
        >
          ↑
        </button>
      </form>
    </main>
  );
}
