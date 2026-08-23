import { useState, useRef, useEffect, type FormEvent } from "react";
import { MessageSquare, X, Send, Bot } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassButton } from "../ui/GlassButton";
import { Markdown } from "../ui/Markdown";
import { useChat } from "@/hooks/useChat";
import { QUICK_PROMPTS } from "@/services/chat";

export function HealthCoach() {
  const [open, setOpen] = useState(false);
  const { messages, sending, send } = useChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    void send(text);
  };

  return (
    <div className="fixed bottom-24 right-4 z-90 lg:bottom-6 lg:right-6">
      {/* 1. Floating Trigger Button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            onClick={() => setOpen(true)}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            aria-label="Open Aegis AI Health Coach Chat"
            className="flex size-14 items-center justify-center rounded-full bg-cyan border border-cyan/45 shadow-[0_4px_24px_rgba(34,211,238,0.4)] text-obsidian transition duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <MessageSquare className="size-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* 2. Chat Widget Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.94 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="glass-strong fixed bottom-24 right-4 z-99 flex h-[500px] w-[calc(100vw-32px)] flex-col overflow-hidden rounded-3xl border border-white/12 shadow-2xl sm:bottom-6 sm:right-6 sm:w-96"
          >
            {/* Header */}
            <header className="flex items-center justify-between border-b border-white/8 px-4.5 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-xl bg-cyan/10 border border-cyan/20 text-cyan">
                  <Bot className="size-4.5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold tracking-tight">Aegis Health Coach</h3>
                  <p className="text-[9px] uppercase tracking-wider text-cyan">AI Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)} aria-label="Close Chat"
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-fg-muted hover:text-fg transition"
              >
                <X className="size-4" />
              </button>
            </header>

            {/* Message Area */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4 scroll-none">
              {messages.map((m) => {
                const isUser = m.role === "user";
                return (
                  <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed border ${
                      isUser
                        ? "bg-cyan/10 border-cyan/15 text-cyan rounded-tr-none"
                        : "bg-white/5 border-white/6 text-fg rounded-tl-none"
                    }`}>
                      <Markdown text={m.text} />
                    </div>
                  </div>
                );
              })}
              {sending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1.5 rounded-2xl bg-white/5 border border-white/6 px-4 py-3 rounded-tl-none">
                    <span className="size-1.5 animate-bounce rounded-full bg-cyan/60" />
                    <span className="size-1.5 [animation-delay:0.2s] animate-bounce rounded-full bg-cyan/60" />
                    <span className="size-1.5 [animation-delay:0.4s] animate-bounce rounded-full bg-cyan/60" />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Quick Suggestions */}
            {messages.length === 1 && (
              <div className="border-t border-white/6 px-4.5 py-2.5 flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p} onClick={() => void send(p)}
                    className="rounded-xl border border-white/8 bg-white/5 px-2.5 py-1.5 text-[10px] text-fg-muted transition hover:text-fg hover:border-white/15"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            {/* Form Input */}
            <form onSubmit={handleSubmit} className="border-t border-white/8 p-3 flex gap-2">
              <input
                type="text" value={input} onChange={(e) => setInput(e.target.value)} disabled={sending}
                placeholder="Ask Aegis health coach..."
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4.5 py-2.5 text-xs text-fg placeholder:text-fg-faint outline-none transition focus:border-cyan/50 focus:bg-white/[0.06]"
              />
              <GlassButton variant="primary" type="submit" size="sm" className="rounded-xl" disabled={!input.trim()}>
                <Send className="size-3.5" />
              </GlassButton>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
