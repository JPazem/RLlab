import { type CSSProperties, useEffect, useRef, useState } from "react";
import NovaFace from "./assets/Nova_Portrait.png";

export type MemoryView = "glow" | "h" | "policy";
export type MemoryCell = { h: number[]; glow: number[]; probabilities?: number[]; blocked?: boolean; known?: boolean; percept?: { color: string; object: string } };
export type Memory = MemoryCell[][];
type MemoryText = {
  memoryShown: string;
  memoryRepresentation: string;
  glow: string;
  hValues: string;
  policy: string;
  actions: string[];
  novaPosition: string;
};

const ACTION_COLORS = ["#256d55", "#376bb5", "#d2764e", "#7357a6"];
const COMPACT_NUMBERS = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 0 });

export function MemoryGrid({
  memory,
  text,
  view,
  focus,
  highlightUpdates = false,
  showValues = true,
  colorActions = false,
  glowColor = "green",
  emphasizeStrength = true,
  showAgent = false,
  cellSize: preferredSize = 120,
  fitToPanel = false,
  heightAllowance = 420,
  roomShape = false,
  revealKnown = false,
  showPercepts = false,
  connections = [],
}: {
  memory: Memory;
  text: MemoryText;
  view: MemoryView;
  focus?: { x: number; y: number };
  highlightUpdates?: boolean;
  showValues?: boolean;
  colorActions?: boolean;
  glowColor?: "green" | "red";
  emphasizeStrength?: boolean;
  showAgent?: boolean;
  cellSize?: number;
  fitToPanel?: boolean;
  heightAllowance?: number;
  roomShape?: boolean;
  revealKnown?: boolean;
  showPercepts?: boolean;
  connections?: { x: number; y: number }[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(preferredSize);
  const columns = memory[0]?.length || 1;
  const rows = memory.length || 1;
  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !fitToPanel) {
      setCellSize(preferredSize);
      return;
    }
    const resize = () => {
      const available = element.clientWidth - 12;
      const heightBudget = window.innerWidth > 1050 ? Math.max(320, window.innerHeight - heightAllowance) : 600;
      setCellSize(Math.floor(Math.max(68, Math.min(preferredSize,
        (available - (columns - 1) * 8 - 10) / columns,
        (heightBudget - (rows - 1) * 8 - 10) / rows))));
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener("resize", resize);
    resize();
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [fitToPanel, preferredSize, columns, rows, heightAllowance]);
  const visible = memory.flatMap((row, y) => row.flatMap((cell, x) => !cell.blocked && (!revealKnown || cell.known !== false) ? [{ x, y }] : []));
  const left = revealKnown && visible.length ? Math.min(...visible.map((point) => point.x)) : 0;
  const top = revealKnown && visible.length ? Math.min(...visible.map((point) => point.y)) : 0;
  const right = revealKnown && visible.length ? Math.max(...visible.map((point) => point.x)) : (memory[0]?.length || 1) - 1;
  const bottom = revealKnown && visible.length ? Math.max(...visible.map((point) => point.y)) : memory.length - 1;
  const width = right - left + 1;
  const height = bottom - top + 1;
  const gap = fitToPanel ? 8 : connections.length ? 20 : 12;
  const gridWidth = width * cellSize + (width - 1) * gap + 10;
  const gridHeight = height * cellSize + (height - 1) * gap + 10;
  const links = new Map<string, { from: { x: number; y: number }; to: { x: number; y: number } }>();
  connections.slice(1).forEach((to, index) => {
    const from = connections[index];
    if (Math.abs(to.x - from.x) + Math.abs(to.y - from.y) !== 1) return;
    const key = [`${from.x},${from.y}`, `${to.x},${to.y}`].sort().join("/");
    links.set(key, { from, to });
  });
  const viewLabel = view === "glow" ? text.glow : view === "h" ? text.hValues : text.policy;
  return (
    <div ref={scrollRef} className={`memory-grid-scroll ${fitToPanel ? "compact-memory" : ""}`}>
    <div
      className={`memory-grid fixed-memory-grid ${roomShape ? "memory-room-grid" : ""}`}
      aria-label={text.memoryShown.replace("{view}", viewLabel)}
      style={{
        gridTemplateColumns: `repeat(${width}, 1fr)`,
        gridTemplateRows: `repeat(${height}, ${cellSize}px)`,
        gap,
        width: gridWidth,
        height: gridHeight,
        aspectRatio: "auto",
        "--memory-arrow-size": `${Math.min(32, cellSize * (fitToPanel ? .19 : .22))}px`,
        "--memory-value-size": `${Math.max(12, Math.min(18, cellSize / (fitToPanel ? 6 : 7.5)))}px`,
        "--memory-percept-size": `${Math.min(28, cellSize * .23)}px`,
      } as CSSProperties}
    >
      {links.size > 0 && <svg className="memory-chain-links" width={gridWidth} height={gridHeight} aria-hidden="true">
        {[...links].map(([key, { from, to }]) => <line key={key}
          x1={5 + (from.x - left) * (cellSize + gap) + cellSize / 2}
          y1={5 + (from.y - top) * (cellSize + gap) + cellSize / 2}
          x2={5 + (to.x - left) * (cellSize + gap) + cellSize / 2}
          y2={5 + (to.y - top) * (cellSize + gap) + cellSize / 2}
        />)}
      </svg>}
      {memory.slice(top, bottom + 1).flatMap((row, rowIndex) => row.slice(left, right + 1).map((cell, columnIndex) => {
        const x = left + columnIndex;
        const y = top + rowIndex;
        if (cell.blocked || (revealKnown && cell.known === false)) return <div className={roomShape ? "memory-room-gap" : "memory-cell memory-wall"} key={`${x}-${y}`} aria-hidden="true" />;
        const total = cell.h.reduce((sum, value) => sum + value, 0) || 1;
        const values = view === "policy" ? cell.probabilities ?? cell.h.map((value) => value / total) : view === "h" ? cell.h : cell.glow;
        const max = Math.max(...values);
        const focused = focus?.x === x && focus?.y === y;
        const cellGlow = Math.max(...cell.glow);
        const updatedCell = highlightUpdates && view === "h" && cellGlow > 0.02;
        return (
          <div
            className={`memory-cell ${focused ? "memory-focus" : ""} ${updatedCell ? "memory-updated" : ""}`}
            data-memory-x={x}
            data-memory-y={y}
            style={{
              "--cell-glow": Math.min(1, cellGlow),
              "--glow-rgb": glowColor === "green" ? "29, 165, 111" : "220, 92, 63",
              background: showPercepts ? cell.percept?.color : undefined,
            } as CSSProperties}
            key={`${x}-${y}`}
          >
            {values.map((value, action) => {
              const opacity = view === "glow" ? Math.max(0.16, Math.min(1, value)) : 0.35 + value / (max || 1) * 0.65;
              const arrowColor = colorActions ? ACTION_COLORS[action] : view === "glow" ? glowColor === "green" ? "#1da56f" : "#dc5c3f" : undefined;
              const strength = value / (max || 1);
              return (
                <span
                  className={`memory-arrow memory-arrow-${action} ${updatedCell && cell.glow[action] > 0.02 ? "updated-edge" : ""}`}
                  style={{ color: arrowColor, "--memory-value-color": view === "glow" ? glowColor === "green" ? "#145b40" : "#8b3526" : arrowColor, "--arrow-opacity": opacity } as CSSProperties}
                  key={action}
                  title={`${text.actions[action]}: ${value.toFixed(2)}`}
                >
                  <svg className="memory-arrow-glyph" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 22V3M7 8L12 3L17 8" transform={`rotate(${action * 90} 12 12)`} fill="none" stroke="currentColor" strokeWidth={emphasizeStrength ? 1 + 4 * strength ** 2 : 2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {showValues && <small>{view === "policy" ? `${Math.round(value * 100)}%` : fitToPanel && value >= 100 ? COMPACT_NUMBERS.format(value).toLowerCase() : value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1)}</small>}
                </span>
              );
            })}
            {showAgent && focused && <img className="memory-agent-marker" src={NovaFace} alt={text.novaPosition} />}
            {showPercepts && cell.percept && <span className="memory-percept-marker" aria-label={cell.percept.object}>{cell.percept.object}</span>}
          </div>
        );
      }))}
    </div>
    </div>
  );
}

export function MemoryTabs({ value, onChange, text }: {
  value: MemoryView;
  onChange: (view: MemoryView) => void;
  text: MemoryText;
}) {
  return (
    <div className="memory-tabs" role="tablist" aria-label={text.memoryRepresentation}>
      {(["glow", "h", "policy"] as MemoryView[]).map((view) => (
        <button type="button" className={value === view ? "active" : ""} onClick={() => onChange(view)} key={view} role="tab" aria-selected={value === view}>
          {view === "glow" ? text.glow : view === "h" ? text.hValues : text.policy}
        </button>
      ))}
    </div>
  );
}
