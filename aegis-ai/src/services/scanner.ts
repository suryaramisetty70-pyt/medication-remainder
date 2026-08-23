import { request } from "./api";
import type { VerificationResponse } from "@/types/scanner";

export const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export function validateImage(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) return "Please use a JPEG, PNG or WebP image.";
  if (file.size > MAX_IMAGE_BYTES) return "Image is larger than 6 MB. Try a smaller photo.";
  return null;
}

export async function verifyPill(medicationName: string, image: File): Promise<VerificationResponse> {
  const form = new FormData();
  form.append("medication_name", medicationName);
  form.append("image", image, image.name || "capture.jpg");

  const raw = await request<Record<string, unknown>>("/verify-pill", { method: "POST", body: form, timeoutMs: 45_000 });

  const rawConfidence = Number(raw?.confidence ?? raw?.score ?? 0);
  const confidence = rawConfidence > 1 ? rawConfidence / 100 : rawConfidence;
  const status = String(raw?.status ?? raw?.result ?? "").toLowerCase();

  return {
    verified: Boolean(raw?.verified ?? raw?.match ?? status === "verified"),
    confidence: Number.isFinite(confidence) ? Math.min(Math.max(confidence, 0), 1) : 0,
    matched_medication: (raw?.matched_medication ?? raw?.medication ?? null) as string | null,
    message: (raw?.message ?? raw?.warning ?? raw?.notes ?? null) as string | null,
    details: (raw?.details ?? raw?.attributes ?? null) as VerificationResponse["details"],
  };
}
