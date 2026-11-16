import React, { useRef, useState } from 'react';
import { Layers } from 'lucide-react';

export interface VisualizerZone {
  id?: string;
  slot_key: string;
  /** Fractions of the canvas (0 to 1). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ZoneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TextZoneVisualizerProps {
  /** For example `4:5`. */
  aspectRatio: string;
  zones: VisualizerZone[];
  /** Template preview image drawn behind the zones. */
  imageUrl?: string | null;
  selectedId?: string | null;
  /** The zone currently being edited in a form (drawn dashed). */
  draft?: ZoneRect | null;
  onSelect?: (id: string) => void;
  /** Dragging on the canvas draws a rectangle; the fractions are reported here. */
  onDraw?: (rect: ZoneRect) => void;
}

/** `4:5` to `[4, 5]`; anything unreadable falls back to 4:5. */
export function parseAspectRatio(value: string): [number, number] {
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(value.trim());
  if (!m || Number(m[1]) <= 0 || Number(m[2]) <= 0) return [4, 5];
  return [Number(m[1]), Number(m[2])];
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Rectangle between two points of the canvas, normalised and clamped to the 0-1 range. */
export function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): ZoneRect {
  const x0 = clamp01(Math.min(a.x, b.x));
  const y0 = clamp01(Math.min(a.y, b.y));
  const x1 = clamp01(Math.max(a.x, b.x));
  const y1 = clamp01(Math.max(a.y, b.y));
  return { x: round3(x0), y: round3(y0), w: round3(x1 - x0), h: round3(y1 - y0) };
}

const pct = (n: number) => `${n * 100}%`;

export const TextZoneVisualizer: React.FC<TextZoneVisualizerProps> = ({ aspectRatio, zones, imageUrl, selectedId, draft, onSelect, onDraw }) => {
  const [rw, rh] = parseAspectRatio(aspectRatio);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [drag, setDrag] = useState<{ start: { x: number; y: number }; current: { x: number; y: number } } | null>(null);

  const point = (e: React.PointerEvent): { x: number; y: number } => {
    const r = frameRef.current!.getBoundingClientRect();
    return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) };
  };

  const dragRect = drag ? rectFromPoints(drag.start, drag.current) : null;

  return (
    <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 text-[#F8FAFC]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#60A5FA]" aria-hidden="true" />
          <span className="text-xs font-bold uppercase tracking-wider text-white">{aspectRatio} Text Zone Safe-Area Visualizer</span>
        </div>
        <span className="text-[11px] font-mono text-[#60A5FA]">{zones.length} zona</span>
      </div>

      <div
        ref={frameRef}
        data-testid="zone-canvas"
        role="img"
        aria-label={`Kanvas ${aspectRatio} dengan ${zones.length} zona teks`}
        className={`relative mx-auto rounded-xl bg-[#090D16] border-2 border-[#2563EB] overflow-hidden select-none ${onDraw ? 'cursor-crosshair touch-none' : ''}`}
        style={{ aspectRatio: `${rw} / ${rh}`, width: rw >= rh ? '100%' : `${Math.min(100, (rw / rh) * 300)}%`, maxWidth: rw >= rh ? 420 : 300 }}
        onPointerDown={(e) => {
          if (!onDraw) return;
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId);
          } catch {
            /* capture is only an optimisation (keeps the drag alive outside the canvas) */
          }
          const p = point(e);
          setDrag({ start: p, current: p });
        }}
        onPointerMove={(e) => {
          if (drag) setDrag({ ...drag, current: point(e) });
        }}
        onPointerUp={(e) => {
          if (!drag) return;
          const rect = rectFromPoints(drag.start, point(e));
          setDrag(null);
          if (rect.w >= 0.02 && rect.h >= 0.02) onDraw?.(rect);
        }}
        onPointerCancel={() => setDrag(null)}
      >
        {imageUrl && <img src={imageUrl} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" />}
        {!imageUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-[10px] font-mono text-[#60A5FA] font-semibold">AI SUBJECT STAGE</span>
            <span className="text-[9px] text-[#94A3B8] mt-0.5">Rasio {aspectRatio}</span>
          </div>
        )}

        {zones.map((z, i) => {
          const selected = !!z.id && z.id === selectedId;
          const cls = `absolute rounded-sm border text-[9px] font-mono leading-tight overflow-hidden px-0.5 ${
            selected ? 'border-white bg-[#2563EB]/60 text-white' : 'border-dashed border-[#60A5FA] bg-[#2563EB]/25 text-white'
          }`;
          const style = { left: pct(z.x), top: pct(z.y), width: pct(z.w), height: pct(z.h) };
          return onSelect && z.id ? (
            <button
              key={z.id}
              type="button"
              className={`${cls} cursor-pointer text-left`}
              style={style}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => onSelect(z.id!)}
              aria-label={`Zona ${z.slot_key}`}
              aria-pressed={selected}
            >
              {z.slot_key}
            </button>
          ) : (
            <div key={z.id ?? `${z.slot_key}-${i}`} className={`${cls} pointer-events-none`} style={style}>
              {z.slot_key}
            </div>
          );
        })}

        {draft && (
          <div
            className="absolute rounded-sm border-2 border-dashed border-amber-400 bg-amber-400/20 pointer-events-none"
            style={{ left: pct(draft.x), top: pct(draft.y), width: pct(draft.w), height: pct(draft.h) }}
            aria-hidden="true"
          />
        )}
        {dragRect && (
          <div
            className="absolute border-2 border-white bg-white/10 pointer-events-none"
            style={{ left: pct(dragRect.x), top: pct(dragRect.y), width: pct(dragRect.w), height: pct(dragRect.h) }}
            aria-hidden="true"
          />
        )}
      </div>
      {onDraw && <p className="text-[10px] text-[#94A3B8] text-center mt-2">Seret pada kanvas untuk menentukan posisi dan ukuran zona.</p>}
    </div>
  );
};
