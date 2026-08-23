import { useCallback, useEffect, useRef, useState } from "react";
import { validateImage, verifyPill } from "@/services/scanner";
import { ApiError } from "@/services/api";
import type { VerificationResponse } from "@/types/scanner";

export type ScannerPhase = "idle" | "starting" | "live" | "denied" | "preview" | "verifying" | "result";

export const VERIFY_STAGES = [
  "Image captured",
  "Analyzing appearance",
  "Matching medication",
  "Generating confidence",
];

export function useScanner(open: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<ScannerPhase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<VerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    setPhase("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 1280 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("live");
    } catch {
      setPhase("denied");
    }
  }, []);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setPhase("idle"); setFile(null); setStage(0); setResult(null); setError(null);
      setPreview((url) => { if (url) URL.revokeObjectURL(url); return null; });
      return;
    }
    void startCamera();
    return stopCamera;
  }, [open, startCamera, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const acceptFile = useCallback((f: File) => {
    const invalid = validateImage(f);
    if (invalid) { setError(invalid); return; }
    setError(null);
    setFile(f);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
    stopCamera();
    setPhase("preview");
  }, [stopCamera]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const size = Math.min(video.videoWidth, video.videoHeight, 1024);
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = (video.videoWidth - Math.min(video.videoWidth, video.videoHeight)) / 2;
    const sy = (video.videoHeight - Math.min(video.videoWidth, video.videoHeight)) / 2;
    const s = Math.min(video.videoWidth, video.videoHeight);
    ctx.drawImage(video, sx, sy, s, s, 0, 0, size, size);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (blob) acceptFile(new File([blob], "capture.jpg", { type: "image/jpeg" }));
  }, [acceptFile]);

  const retake = useCallback(() => {
    setFile(null); setResult(null); setStage(0); setError(null);
    setPreview((url) => { if (url) URL.revokeObjectURL(url); return null; });
    void startCamera();
  }, [startCamera]);

  const verify = useCallback(async (medicationName: string) => {
    if (!file) return;
    setPhase("verifying");
    setStage(0);
    // Purely visual progression while the backend works — no fabricated results.
    const timers = [700, 1500, 2400].map((ms, i) =>
      window.setTimeout(() => setStage(i + 1), ms),
    );
    try {
      const res = await verifyPill(medicationName, file);
      setResult(res);
      setPhase("result");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed.");
      setPhase("preview");
    } finally {
      timers.forEach(window.clearTimeout);
    }
  }, [file]);

  return { videoRef, phase, preview, stage, result, error, capture, acceptFile, retake, verify, startCamera, stopCamera };
}
