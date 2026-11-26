"use client";

import { MessageCircleQuestion, Send, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { askConcierge, conciergeHandoff } from "./actions";
import type { ConciergeReply } from "./engine";

interface Turn {
  from: "user" | "bot";
  text: string;
  actions?: ConciergeReply["actions"];
  question?: string;
}

const SUGGESTIONS = ["Como agendar?", "Horário de atendimento", "Quero remarcar", "Como acesso o portal?"];

/** Recepção digital. A conversa não é armazenada (fica só nesta aba). */
export function ConciergeWidget() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [turns, setTurns] = useState<Turn[]>([
    { from: "bot", text: "Olá! Sou a recepção digital. Respondo dúvidas administrativas — não faço diagnósticos. Como posso ajudar?" },
  ]);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const list = useRef<HTMLOListElement>(null);

  const ask = (q: string) => {
    if (!q.trim()) return;
    setTurns((t) => [...t, { from: "user", text: q }]);
    setInput("");
    start(async () => {
      const r = await askConcierge(q);
      setTurns((t) => [...t, { from: "bot", text: r.text, actions: r.actions, question: q }]);
      requestAnimationFrame(() => list.current?.lastElementChild?.scrollIntoView({ block: "end" }));
    });
  };

  const handoff = (q: string) =>
    start(async () => {
      const r = await conciergeHandoff(q);
      setTurns((t) => [...t, { from: "bot", text: r.message }]);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="fixed right-4 bottom-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-olive px-5 text-sm font-semibold text-ivory shadow-[0_12px_30px_-12px_rgb(32_36_32/0.6)] hover:bg-onyx"
        aria-haspopup="dialog"
      >
        <MessageCircleQuestion aria-hidden className="size-5" /> Recepção digital
      </button>
      <dialog
        ref={dialog}
        aria-label="Recepção digital"
        className="m-0 mt-auto ml-auto h-[min(36rem,100dvh)] max-h-none w-full max-w-md rounded-t-2xl bg-ivory p-0 text-onyx sm:mr-4 sm:mb-4 sm:rounded-2xl"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-onyx/10 px-5 py-3">
            <div>
              <p className="font-display text-xl">Recepção digital</p>
              <p className="text-xs text-mist">Respostas automáticas sobre a clínica. Não armazenamos esta conversa.</p>
            </div>
            <button type="button" aria-label="Fechar" className="grid size-10 place-items-center" onClick={() => dialog.current?.close()}>
              <X aria-hidden className="size-5" />
            </button>
          </header>
          <ol ref={list} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4" aria-live="polite">
            {turns.map((t, i) => (
              <li key={i} className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${t.from === "user" ? "self-end bg-olive text-ivory" : "self-start bg-stone"}`}>
                <span className="sr-only">{t.from === "user" ? "Você:" : "Recepção:"}</span>
                {t.text}
                {t.actions && t.actions.length > 0 && (
                  <span className="mt-2 flex flex-wrap gap-2">
                    {t.actions.map((a) =>
                      a.handoff ? (
                        <button key={a.label} type="button" onClick={() => handoff(t.question ?? "")} className="rounded-full border border-olive px-3 py-1 text-xs text-olive">
                          {a.label}
                        </button>
                      ) : (
                        <Link key={a.label} href={a.href!} onClick={() => dialog.current?.close()} className="rounded-full border border-olive px-3 py-1 text-xs text-olive">
                          {a.label}
                        </Link>
                      ),
                    )}
                  </span>
                )}
              </li>
            ))}
            {pending && <li className="self-start text-xs text-mist">Digitando…</li>}
          </ol>
          {turns.length <= 1 && (
            <div className="flex flex-wrap gap-2 px-5 pb-3">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-onyx/15 px-3 py-1.5 text-xs">
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            className="flex items-center gap-2 border-t border-onyx/10 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <label htmlFor="concierge-input" className="sr-only">Sua pergunta</label>
            <input id="concierge-input" value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="Escreva sua dúvida" className="min-h-11 flex-1 rounded-full border border-onyx/15 bg-transparent px-4 text-sm focus:border-olive focus:ring-0 focus:outline-none" />
            <button type="submit" disabled={pending || !input.trim()} aria-label="Enviar" className="grid size-11 place-items-center rounded-full bg-olive text-ivory disabled:opacity-50">
              <Send aria-hidden className="size-4" />
            </button>
          </form>
        </div>
      </dialog>
    </>
  );
}
