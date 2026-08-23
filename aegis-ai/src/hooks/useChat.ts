import { useCallback, useRef, useState } from "react";
import { sendChat } from "@/services/chat";
import { ApiError } from "@/services/api";
import type { ChatMessage } from "@/types/chat";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "model",
  text:
    "Hi, I'm **Aegis Health Coach**. I can help you stay on top of your medication schedule and adherence.\n\n" +
    "I'm not a doctor — for any medical decision, please speak with a qualified healthcare professional.",
};

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);

  const send = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || inFlight.current) return;
    inFlight.current = true;
    setSending(true);

    const history = messages;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const reply = await sendChat(text, history);
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "model", text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: "model",
        text: err instanceof ApiError
          ? `I couldn't reach the Aegis backend. ${err.message}`
          : "Something went wrong on the way to the Aegis backend.",
      }]);
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }, [messages]);

  return { messages, sending, send };
}
