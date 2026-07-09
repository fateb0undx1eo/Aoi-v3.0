import { useCallback, useState } from "react";
import { nanoid } from "nanoid";
import { Zap } from "lucide-react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { C } from "./constants";

export type Toast = { id: string; state: "idle" | "success" | "error" | "info" | "sending" | "confirm"; text: string; onConfirm?: () => void; onCancel?: () => void };

export function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: string) => void }) {
  const confirmToast = toasts.find((t) => t.state === "confirm");
  const regularToasts = toasts.filter((t) => t.state !== "confirm");
  return (
    <>
      {confirmToast && (
        <div key={confirmToast.id} onClick={() => { confirmToast.onCancel?.(); onDismiss(confirmToast.id); }} style={{
          position: "fixed", inset: 0, zIndex: 9999,
          display: "flex", alignItems: "center", justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.55)",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            animation: "slideUp 0.3s ease-out",
            display: "flex", alignItems: "center", borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            backgroundColor: "#111111", color: "#fff",
            fontSize: 14, fontWeight: 500,
            overflow: "hidden", maxWidth: 420, width: "100%",
          }}>
            <div style={{ width: 4, backgroundColor: "#ef4444", flexShrink: 0, alignSelf: "stretch" }} />
            <div style={{ flex: 1, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CoolIcon icon="Triangle_Warning" size={18} style={{ color: "#ef4444", flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#a1a1aa", lineHeight: 1.4 }}>{confirmToast.text}</span>
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={() => { confirmToast.onConfirm?.(); onDismiss(confirmToast.id); }}
                  style={{
                    padding: "7px 16px", borderRadius: 6, border: "none",
                    backgroundColor: "#ef4444", color: "#fff", cursor: "pointer",
                    fontSize: 12, fontWeight: 600,
                  }}>
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={{
        position: "fixed", bottom: 24, left: 0, right: 0,
        zIndex: 9999, display: "flex", flexDirection: "column", gap: 8, pointerEvents: "none",
        alignItems: "center",
      }}>
        {regularToasts.map((toast) => {
          const colors: Record<string, { bg: string; text: string }> = {
            success: { bg: "rgba(5,150,105,0.15)", text: "#34d399" },
            error:   { bg: "rgba(239,68,68,0.15)",  text: "#f87171" },
            info:    { bg: "rgba(14,165,233,0.15)",  text: "#38bdf8" },
            sending: { bg: "rgba(245,158,11,0.15)",  text: "#fbbf24" },
          };
          const c = colors[toast.state] || colors.info!;
          return (
            <div key={toast.id} style={{
              pointerEvents: "auto",
              animation: "slideUp 0.3s ease-out",
              display: "flex", alignItems: "center", gap: 10,
              padding: "12px 20px", borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.06)",
              backgroundColor: c.bg, color: c.text,
              fontSize: 14, fontWeight: 500,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}>
              {toast.state === "error"   && <CoolIcon icon="Triangle_Warning" size={16} style={{ flexShrink: 0 }} />}
              {toast.state === "success" && <CoolIcon icon="Check" size={16} style={{ flexShrink: 0 }} />}
              {toast.state === "sending" && <Zap style={{ width: 16, height: 16, flexShrink: 0 }} />}
              <span>{toast.text}</span>
              <button type="button" onClick={() => onDismiss(toast.id)}
                style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", opacity: 0.6, cursor: "pointer" }}>
                <CoolIcon icon="Close_MD" size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((state: Toast["state"], text: string) => {
    const id = nanoid(6);
    setToasts((prev) => [...prev, { id, state, text }]);
    if (state !== "sending") {
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const confirmAction = useCallback((text: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const id = nanoid(6);
      setToasts((prev) => [...prev, {
        id, state: "confirm", text,
        onConfirm: () => {
          setToasts((prev) => prev.map((t) => t.id === id ? { ...t, state: "success", text: "Done", onConfirm: undefined, onCancel: undefined } : t));
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2000);
          resolve(true);
        },
        onCancel: () => {
          setToasts((prev) => prev.map((t) => t.id === id ? { ...t, state: "info", text: "Canceled", onConfirm: undefined, onCancel: undefined } : t));
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2000);
          resolve(false);
        },
      }]);
    });
  }, []);

  return { toasts, addToast, dismissToast, confirmAction };
}
