import { useState } from "react";
import { GlassModal } from "./GlassModal";
import { GlassButton } from "./GlassButton";

interface Props {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel = "Delete", onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <GlassModal open={open} onClose={onClose} title={title} className="sm:max-w-sm">
      <div className="space-y-5 p-5">
        <p className="text-sm leading-relaxed text-fg-muted">{description}</p>
        <div className="flex justify-end gap-2">
          <GlassButton variant="ghost" onClick={onClose}>Cancel</GlassButton>
          <GlassButton
            variant="danger" loading={busy}
            onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}
          >
            {confirmLabel}
          </GlassButton>
        </div>
      </div>
    </GlassModal>
  );
}
