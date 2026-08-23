export interface VerificationResponse {
  verified: boolean;
  confidence: number;                  // 0..1 or 0..100 (normalised in service)
  matched_medication?: string | null;
  message?: string | null;
  details?: Record<string, string | number | null> | null;
}
