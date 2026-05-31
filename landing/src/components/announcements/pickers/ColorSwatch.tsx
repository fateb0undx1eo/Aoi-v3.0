import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { ACCENT } from "../constants";
import { intToHex, hsvToHex, hexToHsv } from "../utils/color";

export { hexToHsv, hsvToHex };

export default function ColorSwatch({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const svRef = useRef<HTMLDivElement>(null);
  const hsvRef = useRef({ h: 146, s: 0.5, v: 0.95 });
  const [hsv, setHsv] = useState({ h: 146, s: 0.5, v: 0.95 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if (portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    if (open) { document.addEventListener("mousedown", handler); return () => document.removeEventListener("mousedown", handler); }
  }, [open]);

  const hex = intToHex(value);
  useEffect(() => {
    if (open && value != null) {
      const h = hexToHsv(hex);
      hsvRef.current = h;
      setHsv(h);
      setHexInput(hex.replace("#", ""));
    }
  }, [open]);

  const syncColor = (h: number, s: number, v: number) => {
    const hexColor = hsvToHex(h, s, v);
    const int = parseInt(hexColor.replace("#", ""), 16);
    setHexInput(hexColor.replace("#", ""));
  };

  const commitHex = (raw: string) => {
    const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    if (clean.length === 6) {
      const h = hexToHsv(`#${clean}`);
      hsvRef.current = h;
      setHsv(h);
    } else if (!clean) onChange(null);
    setHexInput(clean);
  };

  const handleHueDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;
    const onMove = (e2: MouseEvent) => {
      const x = Math.max(0, Math.min(1, (e2.clientX - rect.left) / rect.width));
      const hue = x * 360;
      const sv = hsvRef.current;
      syncColor(hue, sv.s, sv.v);
      hsvRef.current = { h: hue, s: sv.s, v: sv.v };
      setHsv({ h: hue, s: sv.s, v: sv.v });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    onMove(e as unknown as MouseEvent);
  };

  const handleSvDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = svRef.current?.getBoundingClientRect();
    if (!rect) return;
    const onMove = (e2: MouseEvent) => {
      const s = Math.max(0, Math.min(1, (e2.clientX - rect.left) / rect.width));
      const v = Math.max(0, Math.min(1, 1 - (e2.clientY - rect.top) / rect.height));
      const h = hsvRef.current.h;
      syncColor(h, s, v);
      hsvRef.current = { h, s, v };
      setHsv({ h, s, v });
    };
    const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    onMove(e as unknown as MouseEvent);
  };

  const selectedHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="flex h-8 w-12 items-center justify-center rounded border border-zinc-700" style={{ backgroundColor: hex }}>
        <ChevronDown className="h-3 w-3 text-white/70" />
      </button>
      {open && createPortal(
        <div ref={portalRef}>
          <div className="fixed inset-0 z-[99]" onClick={() => setOpen(false)} />
          <div className="fixed left-1/2 top-1/2 z-[100] w-56 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
            <div className="mb-1.5">
              <div ref={hueRef} onMouseDown={handleHueDrag}
                className="relative h-4 w-full cursor-crosshair rounded"
                style={{
                  background: "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
                }}>
                <div className="pointer-events-none absolute left-0 top-0 h-full w-full rounded border border-zinc-700" />
                <div className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-1.5 rounded-sm bg-white shadow-md"
                  style={{ left: `${(hsv.h / 360) * 100}%` }} />
              </div>
            </div>
            <div className="mb-2">
              <div ref={svRef} onMouseDown={handleSvDrag}
                className="relative h-20 w-full cursor-crosshair rounded"
                style={{
                  background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(hsv.h, 1, 1)})`,
                }}>
                <div className="pointer-events-none absolute left-0 top-0 h-full w-full rounded border border-zinc-700" />
                <div className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
                  style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }} />
              </div>
            </div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-6 w-6 shrink-0 rounded border border-zinc-700" style={{ backgroundColor: selectedHex }} />
              <span className="text-xs text-zinc-400">#</span>
              <input type="text" value={hexInput}
                onChange={(e) => commitHex(e.target.value)}
                className="flex-1 rounded border border-zinc-700 bg-black px-2 py-1 text-xs text-zinc-200 outline-none" placeholder="000000" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)}
                className="flex-1 rounded px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200">Cancel</button>
              <button type="button" onClick={() => { onChange(parseInt(selectedHex.replace("#", ""), 16)); setOpen(false); }}
                className="flex-1 rounded px-2 py-1.5 text-xs font-medium text-white transition-colors"
                style={{ backgroundColor: ACCENT }}>Select</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
