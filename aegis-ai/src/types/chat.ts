export type ChatRole = "user" | "model";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  pending?: boolean;
}

export interface ChatRequest {
  message: string;
  history: { role: ChatRole; text: string }[];
}

export interface ChatResponse {
  reply?: string;
  text?: string;
  message?: string;
}
