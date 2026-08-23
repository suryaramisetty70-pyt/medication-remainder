import { request } from "./api";
import type { ChatMessage, ChatResponse } from "@/types/chat";

export async function sendChat(message: string, history: ChatMessage[]): Promise<string> {
  const res = await request<ChatResponse>("/chat", {
    method: "POST",
    timeoutMs: 45_000,
    body: {
      message,
      history: history
        .filter((m) => !m.pending)
        .map(({ role, text }) => ({ role, text })),
    },
  });
  return res?.reply ?? res?.text ?? res?.message ?? "I couldn't produce a response just now.";
}

export const QUICK_PROMPTS = [
  "What doses do I have today?",
  "How is my adherence?",
  "What medication is next?",
  "Show my missed doses",
];
