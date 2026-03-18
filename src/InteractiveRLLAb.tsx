import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
// import { Switch } from "./components/ui/switch";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, AreaChart, Area, Label as ChartLabel } from "recharts";
import { Play, Pause, RotateCcw, Brain, Bot, Sprout, Trophy, Skull, CirclePlay, Ban, HelpCircle, BookOpen, Info, X, KeyRound, DoorClosedLocked, DoorOpen} from "lucide-react";
import { motion } from "framer-motion";
import qrCode from "./assets/QR_Code_RLGame_Outreach.png";

const ACTIONS = ["up", "right", "down", "left"] as const;
type Action = typeof ACTIONS[number];

type CellType = "empty" | "wall" | "goal" | "lava" | "start" | "key" | "door-closed" | "door-open";

type LevelConfig = {
  id: number;
  name: string;
  description: string;
  preset: string;
  gridW: number;
  gridH: number;
  lockedParams: Partial<{
    psLambda: number;
    psGamma: number;
    psGlowEta: number;
    epsilon: number;
    tau: number;
    stepCost: number;
    goalReward: number;
    lavaPenalty: number;
  }>;
  adjustableParams: string[]; // parameter names that user can adjust
  winThreshold: number; // minimum return threshold for win condition
  instructions: string;
};

const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "Demo",
    description: "Learn the basics with an small grid",
    preset: "open",
    gridW: 4,
    gridH: 4,
    lockedParams: {},
    adjustableParams: ["psLambda", "psGamma", "psGlowEta", "epsilon", "tau", "stepCost", "goalReward", "lavaPenalty"],
    winThreshold: 1,
    instructions: "Welcome to the RL Lab! This is a simple open field where the agent needs to learn to reach the goal (🏁). Try running the simulation and watch how the agent learns through trial and error. The agent starts at the bottom-left and the goal is at the top-right."
  },
  {
    id: 2,
    name: "Memory Tuning",
    description: "It's your turn! Tune memory parameters yourself to help the agent reach the goal!",
    preset: "open",
    gridW: 4,
    gridH: 4,
    lockedParams: {stepCost: -0.05, goalReward: 1},
    adjustableParams: ["psLambda", "psGamma", "psGlowEta"],
    winThreshold: 1,
    instructions: "Now you need to tune the memory parameters! Try different combinations to help the agent learn faster."
  },
  {
    id: 3,
    name: "Corridor Challenge",
    description: "Navigate through a narrow corridor",
    preset: "corridor",
    gridW: 7,
    gridH: 5,
    lockedParams: {stepCost: -0.05, goalReward:1, lavaPenalty:-1},
    adjustableParams: ["psGamma", "psLambda", "psGlowEta", "epsilon", "tau", "stepCost", "goalReward", "lavaPenalty"],
    winThreshold: 1,
    instructions: "The environment is now more challenging! The agent must navigate through a narrow corridor. Focus on adjusting the available parameters to help the agent find the optimal path."
  },
  {
    id: 4,
    name: "Two Rooms Challenge",
    description: "Learn to navigate between two rooms, but beware of the locked door!",
    preset: "two-rooms",
    gridW: 7,
    gridH: 5,
    lockedParams: {stepCost: -0.05, goalReward:1, lavaPenalty:-1 },
    adjustableParams: ["tau", "psGamma", "psGlowEta", "epsilon", "psLambda", "epsilon"],
    winThreshold: 1,
    instructions: "Even more challenging! The agent must navigate between two rooms connected by a locked door. First, collect the key (🔑) in the left room to unlock the door (🚪). Reaching the goal without the key gives only 1/3 of the full reward. Adjust the available parameters to help the agent learn this key-door mechanic."
  },
  {
    id: 5,
    name: "Maze Master",
    description: "Unlock the door and get to the trophy without falling in the lava!",
    preset: "maze",
    gridW: 7,
    gridH: 5,
    lockedParams: {tau: 1 },
    adjustableParams: ["stepCost", "goalReward", "lavaPenalty", "psLambda", "psGamma", "psGlowEta", "epsilon"],
    winThreshold: 1,
    instructions: "The ultimate challenge! Navigate through a complex maze with many walls and dead ends. Can you find the perfect reward structure to guide the agent through this maze?"
  }
];

type PointTR = { t: number; R: number };
type PointTC = { t: number; C: number };
type PointEG = { ep: number; G: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function makeGrid(w: number, h: number, preset: string): CellType[][] {
  const grid: CellType[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => "empty" as CellType));
  if (preset === "open") {
    grid[0][w - 1] = "goal";
    grid[h - 1][0] = "start";
    // grid[h - 1][w - 2] = "lava";
  } else if (preset === "corridor") {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) grid[y][x] = y === Math.floor(h / 2) ? "empty" : "wall";
    grid[h - 1][0] = "start";
    grid[Math.floor(h / 2)][w - 1] = "goal";
  } else if (preset === "two-rooms") {
    const doorY = Math.floor(h / 2);
    const mid = Math.floor(w / 2);
    for (let y = 0; y < h; y++) {
      if (y === doorY) continue;
      grid[y][mid] = "wall";
    }
    grid[doorY][mid] = "door-closed";
    grid[h - 1][0] = "start";
    grid[h - 2][1] = "key";
    grid[0][w - 2] = "goal";
  } else if (preset === "maze") {
    // for (let y = 1; y < h - 1; y += 2) {
    //   for (let x = 1; x < w - 1; x++) grid[y][x] = "wall";
    //   const gap = 1 + ((y * 3) % (w - 2));
    //   grid[y][gap] = "empty";
    // }
    // grid[h-1][1] = "lava";
    // grid[0][w-2] = "lava";
    // grid[h - 1][0] = "start";
    // grid[0][w - 1] = "goal";
    const doorY = Math.floor(h / 2);
    const mid = Math.floor(w / 2);
    for (let y = 0; y < h; y++) {
      if (y === doorY) continue;
      grid[y][mid] = "wall";
    }
    grid[doorY][mid] = "door-closed";
    grid[h - 1][0] = "start";
    grid[0][0] = "key";
    grid[1][0] = "wall";
    grid[doorY-1][mid+1]="lava";
    grid[0][w - 2] = "goal";
  }
  return grid;
}

class PSLayer {
  w:number; h:number; hvals: Float32Array; gvals: Float32Array;
  constructor(w:number,h:number){
    this.w=w; this.h=h; this.hvals = new Float32Array(w*h*4).fill(1);
    this.gvals = new Float32Array(w*h*4);
  }
  idx(x:number,y:number,a:number){ return ((y*this.w)+x)*4 + a; }
  getH(x:number,y:number,a:number){ return this.hvals[this.idx(x,y,a)]; }
  getG(x:number,y:number,a:number){ return this.gvals[this.idx(x,y,a)]; }
  decayGlow(eta:number){ for (let i=0;i<this.gvals.length;i++) this.gvals[i]*=(1-eta); }
  addGlow(x:number,y:number,a:number,amount:number){ this.gvals[this.idx(x,y,a)]+=amount; }
  rewardUpdate(r:number,gamma:number,lambda:number){
    for (let i=0;i<this.hvals.length;i++){
      const h=this.hvals[i]; const g=this.gvals[i];
      const delta=(-gamma)*h+gamma*1+g*r*lambda;
      this.hvals[i]=h+delta;
    }
  }
  normalize(){
    for (let i=0;i<this.hvals.length;i++) this.hvals[i]=Math.max(0.1,Math.min(10,this.hvals[i]));
    for (let i=0;i<this.gvals.length;i++) this.gvals[i]=Math.max(0,Math.min(5,this.gvals[i]));
  }
}

function stepXY(x:number,y:number,a:Action){
  if(a==="up")return{x,y:y-1};
  if(a==="down")return{x,y:y+1};
  if(a==="left")return{x:x-1,y};
  if(a==="right")return{x:x+1,y};
  return{x:x+1,y};
}

function SliderWithVal({ label, min, max, step=1, value, onChange, help, disabled }: { label: string, min: number, max: number, step?: number, value: number, onChange: (v:number)=>void, help?: React.ReactNode, disabled?: boolean }){
  return (
    <div className={disabled ? "opacity-50" : ""}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1">
          <Label className={!disabled ? "!text-slate-700" : "!text-slate-400"}>{label}</Label>
          {help && (
            <Button
              style={{backgroundColor: "transparent", borderColor: "transparent"}}
              className="border-0 outline-none ring-0 focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0 p-0 h-auto w-auto group relative"
              variant="ghost"
              disabled={disabled}
              title={typeof help === "string" ? help : undefined}
            >
              <HelpCircle className="size-[30px] text-indigo-900" />
              <span className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-64 whitespace-normal text-left bg-blue-50 border border-blue-200 rounded p-2 text-xs text-slate-700 z-10">{help}</span>
            </Button>
          )}
        </div>
        <span className={`text-xs ${!disabled ? "!text-slate-700" : "!text-slate-400"}`}>{typeof value==="number"? value.toFixed(2): value}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value as number]}
        onValueChange={(v: number[]) => {
          const raw = v[0];
          const next = Number.isFinite(raw) ? clamp(raw, min, max) : min;
          onChange(next);
        }}
        disabled={disabled}
      />
    </div>
  );
}

// Error Boundary for PSInspector
class PSInspectorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("PSInspector Error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <div className="font-semibold mb-2">⚠️ Memory Grid Error</div>
          <div className="text-xs">The memory visualization encountered an error. Try resetting the level.</div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-2 py-1 bg-red-200 hover:bg-red-300 rounded text-xs"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PSInspector({
  grid,
  ps,
  cellSize,
}: {

  grid: CellType[][];
  ps: PSLayer;
  cellSize: number;
}) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  // Validate grid and ps layer
  if (!grid || grid.length === 0 || !ps || !ps.hvals || !ps.gvals) {
    return <div className="p-2 text-xs text-slate-500">No grid data available</div>;
  }

  // Compute grid data (removed memoization to ensure real-time glow updates)
  const gridData = Array.from({ length: grid.length }).map((_, y) =>
    Array.from({ length: grid[0]?.length ?? 0 }).map((__, x) => {
      const c = grid[y]?.[x];
      const isWall = c === "wall";

      if (isWall) return { type: 'wall' };

      const hVals = [0, 1, 2, 3].map((a) => {
        const h = ps.getH(x, y, a) || 0;
        return Number.isFinite(h) ? h : 0;
      });
      
      const sumH = hVals.reduce((a, b) => a + b, 0) || 1;
      const probs = hVals.map((h) => Math.max(0, Math.min(1, h / sumH)));
      let bg = "#fbfaf3ff";
      if (c === "key") bg = "#3b82f6"; // Blue for key
      if (c === "door-closed") bg = "#a56c2a" ; // Brown for door
      if (c === "door-open") bg = "#228b22"; // Green for open door

      let glow = 0;
      for (let a = 0; a < 4; a++) {
        const g = ps.getG(x, y, a) || 0;
        glow = Math.max(glow, Number.isFinite(g) ? g : 0);
      }
      const ringOpacity = glow/2;
      // const ringOpacity = Math.min(glow / 2, 0.7);

      return { type: 'cell', probs, bg, ringOpacity, cell: c };
    })
  );

  return (
    <div className="overflow-auto">
      <div className="inline-block border">
        {gridData.length === 0 ? (
          <div className="p-2 text-xs text-slate-500">Unable to load grid data</div>
        ) : (
          gridData.map((row, y) => (
            <div key={`pi-${y}`} className="flex">
              {row.map((cellData, x) => {
                if (cellData.type === 'wall') {
                  return (
                    <div
                      key={`pi-${x}-${y}`}
                      className="border border-neutral-300"
                      style={{
                        width: cellSize,
                        height: cellSize,
                        background: "#3b434bff",
                      }}
                    />
                  );
                }

                const { probs, bg, ringOpacity, cell } = cellData as { type: 'cell'; probs: number[]; bg: string; ringOpacity: number; cell: CellType };

                return (
                  <div
                    key={`pi-${x}-${y}`}
                    onMouseEnter={() => setHover({ x, y })}
                    onMouseLeave={() => setHover(null)}
                    className="relative border border-neutral-300 flex items-center justify-center"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      background: bg,
                      position: "relative",
                    }}
                  >
                    {/* SVG Policy Arrows */}
                    <svg
                      className="absolute inset-0"
                      viewBox="0 0 100 100"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <defs>
                        <marker
                          id="arrowhead"
                          markerWidth="6"
                          markerHeight="6"
                          refX="2"
                          refY="2"
                          orient="auto"
                          markerUnits="strokeWidth"
                        >
                          <path d="M0,0 L0,4 L4,2 Z" fill="rgba(79,70,229,0.9)" />
                        </marker>
                      </defs>

                      {(() => {
                        const drawArrow = (dx: number, dy: number, prob: number) => {
                          const center = 50;
                          const len = 35;
                          const x1 = center;
                          const y1 = center;
                          const x2 = center + dx * len;
                          const y2 = center + dy * len;

                          const scaledProb = Math.max(0, Math.min(1, prob));
                          // const strokeW = 2  + scaledProb * 15;
                          const strokeW = 4;
                          const opacity = 0.25 + scaledProb * 0.75;

                          return (
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke="rgba(79,70,229,0.9)"
                              strokeWidth={strokeW}
                              markerEnd="url(#arrowhead)"
                              strokeLinecap="round"
                              opacity={opacity}
                            />
                          );
                        };

                        return (
                          <>
                            {drawArrow(0, -1, probs[0])} {/* up */}
                            {drawArrow(1, 0, probs[1])} {/* right */}
                            {drawArrow(0, 1, probs[2])} {/* down */}
                            {drawArrow(-1, 0, probs[3])} {/* left */}
                          </>
                        );
                      })()}
                    </svg>

                    {/* Glow halo */}
                    <div
                      className="absolute inset-0 rounded-md pointer-events-none"
                      style={{
                        boxShadow: `0 0 0 3px rgba(59,130,246,${ringOpacity}) inset`,
                      }}
                    />

                    {/* Special symbols */}
                    {cell === "goal" && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                        <Trophy className="absolute inset-0 m-auto w-7 h-7 text-green-700" />
                      </span>
                    )}
                    {cell === "lava" && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                        <Skull className="absolute inset-0 m-auto w-7 h-7 text-red-700" />
                      </span>
                    )}
                    {cell === "start" && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      <CirclePlay className="absolute inset-0 m-auto w-7 h-7 text-yellow-400" />
                      </span>
                    )}
                    {cell === "key" && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      <KeyRound className="absolute inset-0 m-auto w-7 h-7 text-blue-400" />
                      </span>
                    )}
                    {cell === "door-closed" && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      <DoorClosedLocked className="absolute inset-0 m-auto w-7 h-7 text-brown-400" />
                      </span>
                    )}
                    {cell === "door-open" && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      <DoorOpen className="absolute inset-0 m-auto w-7 h-7 text-brown-400" />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {hover && gridData.length > 0 && (
        <div className="mt-2 text-xs text-neutral-700">
          <div> PS cell ({hover.x},{hover.y}) — h: [↑ {fmt(ps.getH(hover.x,hover.y,0))}, → {fmt(ps.getH(hover.x,hover.y,1))}, ↓ {fmt(ps.getH(hover.x,hover.y,2))}, ← {fmt(ps.getH(hover.x,hover.y,3))}] </div>
          <div> glow max={fmt(Math.max(ps.getG(hover.x,hover.y,0), ps.getG(hover.x,hover.y,1), ps.getG(hover.x,hover.y,2), ps.getG(hover.x,hover.y,3)))} </div>
        </div>
      )}
    </div>
  );
}

function RewardsPanel({ rewardTrace, cumTrace, episodeReturns }: { rewardTrace: PointTR[]; cumTrace: PointTC[]; episodeReturns: PointEG[]; }) {
  return (
    <Card className="rounded-xl m-0 p-0 shadow-xl flow-col border-slate-100">
      <CardContent className="space-y-2 sm:space-y-4 pt-6">
        <div className="mb-2 sm:mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-700 text-sm sm:text-base">Instantaneous Reward (R)</h3>
            <Button
              style={{backgroundColor: "transparent", borderColor: "transparent"}}
              className="border-0 outline-none ring-0 focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0 p-0 h-auto w-auto group relative"
              variant="ghost"
              title="Shows the immediate reward received at each time step"
            >
              <HelpCircle className="size-[30px] text-indigo-900" />
              <span className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-64 whitespace-normal text-left bg-blue-50 border border-blue-200 rounded p-2 text-xs text-slate-700 z-10">Shows rewards received at each time step during learning</span>
            </Button>
          </div>
          <div className="w-full h-32 sm:h-54 overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rewardTrace} margin={{ top: 10, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" width={60}><ChartLabel value="Time Step" offset={-5} textAnchor="middle" dominantBaseline="central" position="bottom"/></XAxis>
                <YAxis dataKey="R" width={80}><ChartLabel value="Reward" dx={20} dy={-75} textAnchor="middle" dominantBaseline="central" position="left" angle={-90}/></YAxis>
                <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l)=>`t=${l}`}/>
                <Line type="monotone" dataKey="R" strokeWidth={2} dot={false} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="mb-2 sm:mb-4">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-700 text-sm sm:text-base">Cumulative Reward (C)</h3>
            <Button
              style={{backgroundColor: "transparent", borderColor: "transparent"}}
              className="border-0 outline-none ring-0 focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0 p-0 h-auto w-auto group relative"
              variant="ghost"
              title="Shows cumulative reward over time"
            >
              <HelpCircle className="size-[30px] text-indigo-900" />
              <span className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-64 whitespace-normal text-left bg-blue-50 border border-blue-200 rounded p-2 text-xs text-slate-700 z-10">Total reward accumulated over all time steps - measures overall learning progress</span>
            </Button>
          </div>
          <div className="w-full h-32 sm:h-54 overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumTrace} margin={{ top: 10, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" width={60}><ChartLabel value="Time Step" offset={-5} textAnchor="middle" dominantBaseline="central" position="bottom"/></XAxis>
                <YAxis dataKey="C" width={80}><ChartLabel value="Cumulative Reward" dx={20} dy={-60} textAnchor="middle" dominantBaseline="central" position="left" angle={-90}/></YAxis>
                <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l)=>`t=${l}`}/>
                <Area type="monotone" dataKey="C" strokeWidth={2} fillOpacity={0.2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-700 text-sm sm:text-base">Episode Return (G)</h3>
            <Button
              style={{backgroundColor: "transparent", borderColor: "transparent"}}
              className="border-0 outline-none ring-0 focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0 p-0 h-auto w-auto group relative"
              variant="ghost"
              title="Shows total reward per episode"
            >
              <HelpCircle className="size-[30px] text-indigo-900" />
              <span className="hidden group-hover:block absolute bottom-full left-0 mb-2 w-64 whitespace-normal text-left bg-blue-50 border border-blue-200 rounded p-2 text-xs text-slate-700 z-10">Total reward accumulated in each episode - increasing trends show the agent is learning better policies</span>
            </Button>
          </div>
          <div className="w-full h-32 sm:h-54 overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={episodeReturns} margin={{ top: 10, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ep" width={60}><ChartLabel value="Episode Number" offset={-5} textAnchor="middle" dominantBaseline="central" position="bottom"/></XAxis>
                <YAxis dataKey="G" width={80}><ChartLabel value="Return" dx={20} dy={-50} textAnchor="middle" dominantBaseline="central" position="left" angle={-90}/></YAxis>
                <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l)=>`ep=${l}`}/>
                <Line type="monotone" dataKey="G" strokeWidth={2} dot={false} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InteractiveRLLab(){
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gridW,setGridW]=useState(LEVELS[0].gridW);
  const [gridH,setGridH]=useState(LEVELS[0].gridH);
  const [gridWInput, setGridWInput] = useState(String(LEVELS[0].gridW));
  const [gridHInput, setGridHInput] = useState(String(LEVELS[0].gridH));
  const [preset,setPreset]=useState(LEVELS[0].preset);
  const [grid,setGrid]=useState<CellType[][]>(()=>makeGrid(LEVELS[0].gridW, LEVELS[0].gridH, LEVELS[0].preset));
  //const [startPos,setStartPos]=useState<{x:number,y:number}>(()=>({x:0,y:5}));
  // start positions depend on gridH (use gridH - 1 safely)
  const [startPos, setStartPos] = useState<{ x: number; y: number }>(() => ({ x: 0, y: Math.max(0, gridH - 1) }));
  const [agent, setAgent] = useState<{ x: number; y: number }>(() => ({ x: 0, y: Math.max(0, gridH - 1) }));
  // const [agent,setAgent]=useState<{x:number,y:number}>({x:startPos.x,y:startPos.y});
  const [episode,setEpisode]=useState(1);
  const [running,setRunning]=useState(true);
  const [speed,setSpeed]=useState(6);
  const [stepCost,setStepCost]=useState(0);
  const [goalReward,setGoalReward]=useState(1);
  const [lavaPenalty,setLavaPenalty]=useState(-1);
  // const [wind,setWind]=useState(false);
  const [psLambda,setPsLambda]=useState(1);
  const [psGamma,setPsGamma]=useState(0.01);
  const [psGlowEta,setPsGlowEta]=useState(0.05);
  const [epsilon,setEpsilon]=useState(0.1);
  const [tau,setTau]=useState(1);
  const [rewardTrace,setRewardTrace]=useState<PointTR[]>([]);
  const [cumTrace,setCumTrace]=useState<PointTC[]>([]);
  const [episodeReturns,setEpisodeReturns]=useState<PointEG[]>([]);
  const [currentEpReturn,setCurrentEpReturn]=useState(0);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showPsInfo, setShowPsInfo] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [psVersion, setPsVersion] = useState(0);
  const tRef=useRef(0);
  const totalReturnRef=useRef(0);
  const currentEpReturnRef=useRef(0);
  const gameWonRef=useRef(false); // Track game won state in ref to avoid race conditions
  const levelTransitionRef=useRef<ReturnType<typeof setTimeout> | null>(null); // Track timeout to clean up on unmount
  const hasKeyRef=useRef(false);
  const psRef=useRef<PSLayer>(new PSLayer(gridW,gridH));
  const gridRef=useRef(grid); useEffect(()=>{gridRef.current=grid},[grid]);
  const agentRef=useRef(agent); useEffect(()=>{agentRef.current=agent},[agent]);
  const startPosRef=useRef(startPos); useEffect(()=>{startPosRef.current=startPos},[startPos]);
  // const windRef=useRef(wind); useEffect(()=>{windRef.current=wind},[wind]);
  const psLambdaRef=useRef(psLambda); useEffect(()=>{psLambdaRef.current=psLambda},[psLambda]);
  const psGammaRef=useRef(psGamma); useEffect(()=>{psGammaRef.current=psGamma},[psGamma]);
  const psGlowEtaRef=useRef(psGlowEta); useEffect(()=>{psGlowEtaRef.current=psGlowEta},[psGlowEta]);
  const epsilonRef=useRef(epsilon); useEffect(()=>{epsilonRef.current=epsilon},[epsilon]);
  const tauRef=useRef(tau); useEffect(()=>{tauRef.current=tau},[tau]);
  const stepCostRef=useRef(stepCost); useEffect(()=>{stepCostRef.current=stepCost},[stepCost]);
  const goalRewardRef=useRef(goalReward); useEffect(()=>{goalRewardRef.current=goalReward},[goalReward]);
  const lavaPenaltyRef=useRef(lavaPenalty); useEffect(()=>{lavaPenaltyRef.current=lavaPenalty},[lavaPenalty]);

  // Function to load a specific level
  const loadLevel = (levelId: number) => {
    const level = LEVELS.find(l => l.id === levelId);
    if (!level) return;

    // Update grid dimensions and preset
    setGridW(level.gridW);
    setGridH(level.gridH);
    setPreset(level.preset);
    const newGrid = makeGrid(level.gridW, level.gridH, level.preset);
    setGrid(newGrid);
    gridRef.current = newGrid;

    // Calculate start position based on new grid
    let startX = 0, startY = level.gridH - 1;
    for (let y = 0; y < level.gridH; y++) {
      for (let x = 0; x < level.gridW; x++) {
        if (newGrid[y][x] === "start") {
          startX = x;
          startY = y;
          break;
        }
      }
    }
    const newStartPos = { x: startX, y: startY };
    setStartPos(newStartPos);
    setAgent(newStartPos);
    agentRef.current = newStartPos;
    startPosRef.current = newStartPos;

    // Apply locked parameters
    if (level.lockedParams.psLambda !== undefined) {
      setPsLambda(level.lockedParams.psLambda);
      psLambdaRef.current = level.lockedParams.psLambda;
    }
    if (level.lockedParams.psGamma !== undefined) {
      setPsGamma(level.lockedParams.psGamma);
      psGammaRef.current = level.lockedParams.psGamma;
    }
    if (level.lockedParams.psGlowEta !== undefined) {
      setPsGlowEta(level.lockedParams.psGlowEta);
      psGlowEtaRef.current = level.lockedParams.psGlowEta;
    }
    if (level.lockedParams.epsilon !== undefined) {
      setEpsilon(level.lockedParams.epsilon);
      epsilonRef.current = level.lockedParams.epsilon;
    }
    if (level.lockedParams.tau !== undefined) {
      setTau(level.lockedParams.tau);
      tauRef.current = level.lockedParams.tau;
    }
    if (level.lockedParams.stepCost !== undefined) {
      setStepCost(level.lockedParams.stepCost);
      stepCostRef.current = level.lockedParams.stepCost;
    }
    if (level.lockedParams.goalReward !== undefined) {
      setGoalReward(level.lockedParams.goalReward);
      goalRewardRef.current = level.lockedParams.goalReward;
    }
    if (level.lockedParams.lavaPenalty !== undefined) {
      setLavaPenalty(level.lockedParams.lavaPenalty);
      lavaPenaltyRef.current = level.lockedParams.lavaPenalty;
    }

    // Reset game state
    setEpisode(1);
    setRewardTrace([]);
    setCumTrace([]);
    setEpisodeReturns([]);
    setCurrentEpReturn(0);
    setGameWon(false);
    setHasKey(false);
    gameWonRef.current = false; // Also reset the ref
    tRef.current = 0;
    totalReturnRef.current = 0;
    currentEpReturnRef.current = 0;
    psRef.current = new PSLayer(level.gridW, level.gridH);
    startPosRef.current = newStartPos; // Ensure ref is in sync
  };

  // Load initial level
  useEffect(() => {
    loadLevel(currentLevel);
  }, []);

  // Sync gameWonRef with gameWon state
  useEffect(() => {
    gameWonRef.current = gameWon;
  }, [gameWon]);

  // Sync hasKeyRef with hasKey state
  useEffect(() => {
    hasKeyRef.current = hasKey;
  }, [hasKey]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (levelTransitionRef.current) {
        clearTimeout(levelTransitionRef.current);
      }
    };
  }, []);

  useEffect(()=>{psRef.current=new PSLayer(gridW,gridH);},[gridW,gridH]);

  useEffect(()=>{
    const g=makeGrid(gridW,gridH,preset);
    setGrid(g);
    const sp={x:0,y:gridH-1};
    setStartPos(sp);
    setAgent(sp);
    setEpisode(1);
    setRewardTrace([]);
    setCumTrace([]);
    setEpisodeReturns([]);
    setCurrentEpReturn(0);
    tRef.current=0; totalReturnRef.current=0; currentEpReturnRef.current=0;
  },[gridW,gridH,preset]);

  useEffect(() => {
    setGridWInput(String(gridW));
  }, [gridW]);

  useEffect(() => {
    setGridHInput(String(gridH));
  }, [gridH]);

  useEffect(()=>{
    if(!running) return;
    const interval=setInterval(()=>{
      try {
        tick();
      } catch (error) {
        console.error("Error in simulation tick:", error);
        setRunning(false); // Stop the simulation on critical error
      }
    },Math.max(20,1000/Math.max(1,speed)));
    return()=>clearInterval(interval);
  },[running,speed]);

  function envReward(x:number,y:number){
    // Guard against out-of-bounds
    if (x < 0 || y < 0 || !gridRef.current[y] || gridRef.current[y].length === 0) {
      return stepCostRef.current;
    }
    
    const c=gridRef.current[y]?.[x];
    if(c==="goal") {
      return hasKeyRef.current ? goalRewardRef.current : goalRewardRef.current;
    }
    if(c==="lava")return lavaPenaltyRef.current;
    if(c==="wall")return -0.2;
    if(c==="key") {
      setHasKey(true);
      // Change the cell to empty after collecting key
      setGrid(g => {
        const newG = g.map(row => [...row]);
        newG[y][x] = "empty";
        return newG;
      });
      return 0; // No extra reward for key, just collect it
    }
    return stepCostRef.current;
  }

  function isTerminal(x:number,y:number){
    if (x < 0 || y < 0 || !gridRef.current[y] || gridRef.current[y].length === 0) {
      return false;
    }
    const c=gridRef.current[y]?.[x];
    return c==="goal"||c==="lava";
  }

  function legal(x:number,y:number){
    const cell = gridRef.current[y]?.[x];
    if (cell === "wall") return false;
    if (cell === "door-closed" && !hasKeyRef.current) return false;
    return x>=0&&y>=0&&x<gridW&&y<gridH;
  }

  function windJitter(a:number){
    // if(!windRef.current) return a;
    // const r=Math.random();
    // if(r<0.1) return (a+1)%4;
    // if(r<0.2) return (a+3)%4;
    return a;
  }

  function pickAction(x:number,y:number){
    // Guard against invalid inputs
    if (x < 0 || y < 0 || x >= gridW || y >= gridH) {
      return Math.floor(Math.random() * 4);
    }
    
    if (Math.random() < epsilonRef.current) return Math.floor(Math.random()*4);
    
    let hs:number[] = new Array(4).fill(0);
    for (let a=0;a<4;a++) {
      const h = psRef.current.getH(x,y,a) || 0;
      hs[a] = Number.isFinite(h) ? h : 0;
    }
    
    const t=Math.max(0.01, tauRef.current);
    const maxH=Math.max(...hs, 0.01); // Ensure maxH is never 0
    const exps=hs.map(h=>Math.exp((h-maxH)/t));
    const sum=exps.reduce((a,b)=>a+b,0);
    
    if (!Number.isFinite(sum) || sum === 0) return Math.floor(Math.random()*4);
    
    let r=Math.random(); let acc=0;
    for(let a=0;a<4;a++){
      acc+=exps[a]/sum; 
      if(r<=acc)return a;
    }
    return 0;
  }

  function attemptMove(x:number,y:number,a:number){
    const actionIdx = windJitter(a);
    if (actionIdx < 0 || actionIdx >= ACTIONS.length) return {x, y};
    
    const next=stepXY(x,y,ACTIONS[actionIdx]);
    if(!legal(next.x,next.y))return{x,y};
    const c = gridRef.current[next.y][next.x];
    if (hasKeyRef.current && c === "door-closed") {
      setGrid(g => {
        const newG = g.map(row => [...row]);
        newG[next.y][next.x] = "door-open";
        return newG;
      });
      return {x: next.x, y: next.y, reward: goalRewardRef.current / 2};
    }
    return {x: next.x, y: next.y};
  }

  function restartEpisode(lastReward:number){
    const G=currentEpReturnRef.current+lastReward;
    setEpisodeReturns(l => {
      const newReturns = [...l, { ep: (l.length ? l[l.length - 1].ep + 1 : 1), G }];
      
      // Check win condition: last 5 episodes must exceed level's win threshold
      const currentLevelConfig = LEVELS.find(l => l.id === currentLevel);
      const winThreshold = currentLevelConfig?.winThreshold || 5;

      
      if (newReturns.length >= 5) {
        const last5 = newReturns.slice(-5);
        const allGood = last5.every(ep => ep.G >= winThreshold * goalRewardRef.current * 0.75);
        if (allGood && !gameWonRef.current) {
          // Mark game as won immediately to stop further ticks
          gameWonRef.current = true;
          setGameWon(true);
          setRunning(false);
          
          if (currentLevel < LEVELS.length) {
            // Clear any existing timeout
            if (levelTransitionRef.current) {
              clearTimeout(levelTransitionRef.current);
            }
            
            // Schedule level transition after brief delay
            levelTransitionRef.current = setTimeout(() => {
              const nextLevel = currentLevel + 1;
              setCurrentLevel(nextLevel);
              loadLevel(nextLevel);
              // Reset game won for next level
              gameWonRef.current = false;
              setGameWon(false);
              setRunning(true);
              levelTransitionRef.current = null;
            }, 2000);
          }
        }
      }
      
      return newReturns;
    });
    
    // Reset key and door for next episode
    setHasKey(false);
    if (preset === "two-rooms") {
      setGrid(g => {
        const newG = g.map(row => [...row]);
        const doorY = Math.floor(gridH / 2);
        const mid = Math.floor(gridW / 2);
        newG[doorY][mid] = "door-closed";
        newG[gridH - 2][1] = "key";
        return newG;
      });
    }
    
    // Reset for next episode (but don't reset game won state here)
    setEpisode(e=>e+1);
    setCurrentEpReturn(0);
    currentEpReturnRef.current=0;
    setAgent(startPosRef.current);
    agentRef.current=startPosRef.current;
    psRef.current.gvals.fill(0);
  }

  function tick(){
    // Check game won using ref to avoid stale state issues
    if (gameWonRef.current) return;
    
    try {
      const {x,y}=agentRef.current;
      
      // Validate agent position
      if (x < 0 || y < 0 || x >= gridW || y >= gridH) {
        console.warn("Agent out of bounds, resetting to start position");
        setAgent(startPosRef.current);
        agentRef.current = startPosRef.current;
        return;
      }
      
      const a=pickAction(x,y);
      psRef.current.decayGlow(psGlowEtaRef.current);
      psRef.current.addGlow(x,y,a,1);
      const s1=attemptMove(x,y,a);
      
      // Validate new position
      if (s1.x < 0 || s1.y < 0 || s1.x >= gridW || s1.y >= gridH) {
        console.warn("Move resulted in out of bounds position");
        return;
      }
      
      const r = (s1.reward || 0) + envReward(s1.x,s1.y);
      psRef.current.rewardUpdate(r,psGammaRef.current,psLambdaRef.current);
      psRef.current.normalize();
      setPsVersion(v => v + 1);
      tRef.current+=1;
      totalReturnRef.current+=r;
      setRewardTrace(tr=>{const nxt=[...tr,{t:tRef.current,R:r}]; return nxt.length>50?nxt.slice(-50):nxt;}); // Limit to 50 points
      setCumTrace(ct=>{const nxt=[...ct,{t:tRef.current,C:totalReturnRef.current}]; return nxt.length>500?nxt.slice(-500):nxt;}); // Limit to 500 points
      setCurrentEpReturn(v=>v+r);
      setAgent(s1);
      agentRef.current=s1;
      if(isTerminal(s1.x,s1.y)) restartEpisode(r);
    } catch (error) {
      console.error("Error during tick:", error);
      setRunning(false);
      gameWonRef.current = true;
    }
  }

  const cellSize=50;
  const [inspectorSize,setInspectorSize]=useState(60);
  const canvasW=gridW*cellSize;
  const canvasH=gridH*cellSize;
  const [tool,setTool]=useState<"draw"|"pick"|"erase">("draw");
  const [brush,setBrush]=useState<CellType>("wall");

  function onCellClick(x:number,y:number){
    if(tool==="pick"){ setBrush(gridRef.current[y]?.[x] ?? "empty"); return; }
    const b = tool==="erase"?"empty":brush;
    const g = gridRef.current.map(row=>[...row]);
    g[y][x]=b;
    setGrid(g);

    if (b === "start") {
    // Remove previous start
    for (let yy = 0; yy < gridH; yy++) {
      for (let xx = 0; xx < gridW; xx++) {
        if (g[yy][xx] === "start") {
          g[yy][xx] = "empty";
        }
      }
    }

    // Place new start
    g[y][x] = "start";

    // Update refs & state
    const sp = { x, y };
    setStartPos(sp);
    setAgent(sp);
    agentRef.current = sp;
  } else {
    g[y][x] = b;
  }

  setGrid(g);
    
    // if(b==="start"){ setStartPos({x,y}); setAgent({x,y}); agentRef.current={x,y}; }
  }

const StaticGrid = React.memo(function StaticGrid({
  grid,
  gridW,
  gridH,
  cellSize,
  // cellBG,
  onCellClick,
}: {
  grid: string[][],
  gridW: number,
  gridH: number,
  cellSize: number,
  // cellBG: (cell: CellType) => string,
  onCellClick: (x: number, y: number) => void,
}) {
  return (
    <div
      className="absolute top-0 left-0 select-none"
      style={{
        width: gridW * cellSize,
        height: gridH * cellSize,
      }}

    >
      {Array.from({ length: grid.length }).map((_, y) => (
        <div key={y} className="flex">
          {Array.from({ length: grid[0]?.length ?? 0 }).map((__, x) => {
            const cell = grid[y][x];
            return (
              <div
                key={`${x}-${y}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCellClick(x, y);
                }}
                onMouseEnter={(e) => {
                  if (e.buttons === 1) onCellClick(x, y);
                }}
                className="border border-neutral-300 flex items-center justify-center relative"
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: cellBG((grid[y]?.[x] ?? "empty") as CellType),
                }}
                title={`(${x},${y})`}
              >
                {/* 🧱 Environment Icons */}
                {cell === "goal" && (
                  <Trophy className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
                )}
                {cell === "lava" && (
                  <Skull className="w-5 h-5 text-red-500" strokeWidth={2.5} />
                )}
                {cell === "start" && (
                  <CirclePlay className="w-5 h-5 text-yellow-500" strokeWidth={2.5} />
                )}
                {cell === "wall" && (
                  <Ban className="w-5 h-5 text-gray-500 opacity-60" strokeWidth={2.5} />
                )}
                {cell === "key" && (
                  <KeyRound className="w-5 h-5 text-blue-500 opacity-60" strokeWidth={2.5} />
                )}
                {cell === "door-closed" && (
                  <DoorClosedLocked className="w-5 h-5 text-brown-500 opacity-60" strokeWidth={2.5} />
                )}
                {cell === "door-open" && (
                  <DoorOpen className="w-5 h-5 text-brown-500 opacity-60" strokeWidth={2.5} />
                )}


              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});

  return (
    <div className="w-screen min-h-screen flex flex-col bg-purple-900">
    {/* Instructions Modal */}
    {showInstructions && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg">
          <CardHeader className="flex items-center justify-between sticky top-0 bg-white border-b">
            <CardTitle className="text-2xl flex items-center gap-2">
              <BookOpen className="w-6 h-6" /> Level {currentLevel}: {LEVELS.find(l => l.id === currentLevel)?.name}
            </CardTitle>
            <button onClick={() => setShowInstructions(false)} className="text-slate-500 hover:text-slate-700">
              <X className="w-6 h-6" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-700 text-sm p-6">
            <div>
              <h3 className="font-bold mb-2">{LEVELS.find(l => l.id === currentLevel)?.description}</h3>
              <p className="mb-4">
                {LEVELS.find(l => l.id === currentLevel)?.instructions}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Win Condition:</h4>
              <p>Achieve episode returns &gt; {LEVELS.find(l => l.id === currentLevel)?.winThreshold} for the last 5 consecutive episodes.</p>
            </div>
            {LEVELS.find(l => l.id === currentLevel)?.lockedParams && Object.keys(LEVELS.find(l => l.id === currentLevel)?.lockedParams || {}).length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Locked Parameters:</h4>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  {Object.entries(LEVELS.find(l => l.id === currentLevel)?.lockedParams || {}).map(([param, value]) => (
                    <li key={param}>
                      <strong>{param}:</strong> Fixed at {value}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h4 className="font-semibold mb-2">How to Play:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Run the simulation:</strong> Click the play button to start training</li>
                <li><strong>Adjust parameters:</strong> Use the sliders to tune the adjustable parameters above</li>
                <li><strong>Monitor learning:</strong> Watch the policy arrows and reward curves update</li>
                <li><strong>Achieve the win condition:</strong> Get 5 consecutive episodes with returns &gt; {LEVELS.find(l => l.id === currentLevel)?.winThreshold}</li>
                <li><strong>Advance:</strong> Complete the level to unlock the next challenge!</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    
    {/* Info Modal */}
    {showInfo && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg">
          <CardHeader className="flex items-center justify-between sticky top-0 bg-white border-b">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Info className="w-6 h-6" /> General Concepts
            </CardTitle>
            <button onClick={() => setShowInfo(false)} className="text-slate-500 hover:text-slate-700">
              <X className="w-6 h-6" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-700 text-sm p-6">
            <div>
              <h3 className="font-bold mb-2">Reinforcement Learning (RL)</h3>
              <p>
                A machine learning paradigm where an agent learns by interacting with an environment, receiving rewards for actions, and learning to maximize cumulative reward over time. 
                It is used in many fields, ranging from robotics to game playing, and is inspired by how animals learn from their environment.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Projective Simulation (PS)</h3>
              <p>
                A learning algorithm that models decision-making as a random walk on a graph. 
                The memory of the agent is represented as a network of memories, called "clips", that represent experiences the agent had in its environment. 
                These clips are connected in a network, and the more an agent reexperiences a particular transition between clips and gets a positive reward for it, 
                the stronger the connection between these events becomes. To decide which action to take, the agent revisits memories randomly, where a memory is more 
                likely to be revisited if it has a strong connection to the clip the agent is currently in. This allows the agent to learn which sequences of actions lead to rewards and to make decisions based on past experiences.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Environment</h3>
              <p>
                We propose to train a PS agent in a simple grid environment, where the agent has to learn to navigate to a goal efficiently while avoiding hazards. The environment consists of a grid with different types of cells, each providing different rewards or penalties.
              </p>
              <ul className="space-y-2 ml-4">
                <li><strong>Agent (🤠):</strong> The learner that navigates the environment</li>
                <li><strong>Goal (🏁):</strong> The target location where the agent receives positive reward</li>
                <li><strong>Lava (💀):</strong> A penalty zone that the agent learns to avoid</li>
                <li><strong>Walls:</strong> Obstacles the agent cannot pass through</li>
                <li><strong>Reward:</strong> Feedback signal that guides learning</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2">Policy Visualization</h3>
              <p>
                The middle panel (Memory Inspector) shows the learned policy as arrows. Brighter arrows represent actions the agent is more likely to take, learned through experience with rewards.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )}

    {/* Projective Simulation Modal */}
    {showPsInfo && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg">
          <CardHeader className="flex items-center justify-between sticky top-0 bg-white border-b">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Brain className="w-6 h-6" /> Projective Simulation (PS)
            </CardTitle>
            <button onClick={() => setShowPsInfo(false)} className="text-slate-500 hover:text-slate-700">
              <X className="w-6 h-6" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-700 text-sm p-6">
            <div>
              <h3 className="font-bold mb-2">Overview</h3>
              <p>
                Projective Simulation models decision-making as a random walk over a network of
                “clips” (memories of percepts and actions). Learning strengthens connections that
                lead to rewards, shaping the agent’s policy over time.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">How It Learns</h3>
              <p>
                Each experience updates the clip network. Rewards increase the likelihood of
                choosing actions that previously led to success, while decay parameters control how
                quickly old experiences fade.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Memory Parameters</h3>
              <ul className="space-y-2 ml-4">
                <li><strong>Memory damping (γ):</strong> How quickly the agent forgets past experiences.</li>
                <li><strong>Reward coupling (λ):</strong> How strongly rewards reinforce connections between memories.</li>
                <li><strong>Glow decay (η):</strong> How fast the memory of recent transition fades. It enables the agent to learn in environments with sparse rewards.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2">Why It Matters</h3>
              <p>
                These parameters shape how the agent balances short-term rewards with long-term
                learning, influencing how quickly it discovers better strategies.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">How does the agent learn?</h3>
              <p>
                The agent learns by updating its memory network based on experiences. When it takes an action and receives a reward, the connections between the corresponding memories are strengthened, guiding future decisions.
              </p>
            </div>
            <div>
              <h3 className="font-bold mb-2">Memory Update Equations</h3>
              <p>
                The <strong>strength of the connections between memories (clips)</strong> is stored in an <strong>h-value</strong>.
                For a transition from clip i to clip j, the strength is updated as follows upon
                receiving a reward R:
              </p>
                <div className="ps-equations rounded border border-slate-200 bg-slate-50 p-3 text-slate-800">
                <div className="font-mono">
                  h<sub>ij</sub><sup>(next)</sup> = (1 − γ) × h<sub>ij</sub><sup>(now)</sup> + γ × h<sub>ij</sub><sup>(init)</sup> + R<sup>(t)</sup> × λ × g<sub>ij</sub><sup>(t)</sup>
                </div></div>
              <p>
                <strong>Glow values (g)</strong> represents the memory of the past transitions: the more recent a transition was experienced,
                the higher the glow value. Intuitively, glow is illuminating the path the agent took, and this "light" fades over time
                at a rate the depends on η. In Reinforcement Learning, glow can also be related to a so-called eligibility trace: 
                it <strong>flags transitions that might have contributed to a certain reward value</strong>, allowing the agent to assign credit 
                to not only the most recent action, but also to a sequence of past actions that led to the reward. 
                The glow values are updated as follows:
              </p>
              <div className="ps-equations rounded border border-slate-200 bg-slate-50 p-3 text-slate-800 space-y-2">
                <div className="font-mono">g<sub>ij</sub><sup>(next)</sup> = g<sub>ij</sub><sup>(now)</sup> × (1 − η)</div>
              </div>
              <p> 
                and if the transition from clip i to clip j was <strong>just experienced</strong>, then glow is set to 1:
              </p>
               <div className="ps-equations rounded border border-slate-200 bg-slate-50 p-3 text-slate-800 space-y-2">
                <div className="font-mono">g<sub>ij</sub><sup>(next)</sup> = 1 </div>
              </div>

            </div>
          </CardContent>
        </Card>
      </div>
    )}
    
    <Card className="border-slate-100 p-1 m-1" style={{ background: "rgb(146, 226, 219)" }}>
    <CardHeader className="relative flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
      <img src={qrCode} alt="QR code" className="absolute top-0 left-1 w-18 h-18 rounded border border-slate-200 shadow-sm" />
      <div className="text-center sm:text-left pl-16 sm:pl-20">
        <CardTitle className="text-2xl sm:text-3xl items-center flex justify-center gap-2 text-slate-700"><Bot className="w-8 h-8 sm:w-10 sm:h-10"/> Interactive Reinforcement Learning Lab </CardTitle>
        {/* <CardTitle className="text-3xl items-center flex justify-center gap-2"><Bot className="w-10 h-10"/> Interactive Reinforcement Learning Lab </CardTitle> */}
        <p className="text-lg sm:text-xl text-slate-500 mt-1"> Come and train your reinforcement learning agent in real life!</p>
    {gameWon && currentLevel < LEVELS.length && (
      <div className="mt-2 p-3 bg-green-100 border border-green-300 rounded-lg text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-green-800">🎉 Level {currentLevel} Complete! 🎉</h2>
        <p className="text-green-700">Advancing to Level {currentLevel + 1}: {LEVELS.find(l => l.id === currentLevel + 1)?.name}</p>
      </div>
    )}
    {gameWon && currentLevel === LEVELS.length && (
      <div className="mt-2 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-center">
        <h2 className="text-xl sm:text-2xl font-bold text-yellow-800">🏆 Congratulations! 🏆</h2>
        <p className="text-yellow-700">You've completed all levels! You are now an RL Master!</p>
      </div>
    )}
    </div>
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
    <button onClick={() => setShowInfo(true)} title="View general information" className="text-slate-500 hover:text-slate-700 transition-colors">
      <Info className="w-5 h-5 sm:w-6 sm:h-6" />
    </button>
    <Button
          variant={running ? "secondary" : "default"}
          size="sm"
          onClick={() => setRunning(r => !r)}
          className="text-slate-500 hover:text-slate-700 transition-colors"
        >
          {running ? (
            <>
              <Pause className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Pause
            </>
          ) : (
            <>
              <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Run
            </>
          )}
    </Button>

    <Button
        variant="outline"
        size="sm"
        onClick={() => loadLevel(currentLevel)}
        className="text-slate-500 hover:text-slate-700 transition-colors"
      >
        <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Reset Level
    </Button>
    <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setCurrentLevel(1);
          loadLevel(1);
        }}
        className="text-slate-500 hover:text-slate-700 transition-colors"
      >
        <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> Reset Game
    </Button>
    </div>
    </CardHeader>
    </Card>

      <div className="max-w-20xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3 px-2 sm:px-0">
         <Card className="shadow-xl rounded-2xl col-span-1 m-1 sm:m-2 p-2 order-1 lg:order-1" style={{ background: "#f5f5f5ff"}}>
          <CardHeader className="flex items-center justify-center pb-2">
            <CardTitle className="text-2xl text-slate-700 flex items-center justify-between gap-2"><Sprout className="w-10 h-10"/> Build your Environment!</CardTitle>
            {/* <CardTitle className="text-2xl flex items-center justify-between gap-2"><Sprout className="w-10 h-10"/> Build your Environment!</CardTitle> */}
          </CardHeader>
          <CardContent className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Label className="text-sm !text-slate-700">Level:</Label>
                <Select 
                  value={currentLevel.toString()} 
                  onValueChange={(value) => {
                    const levelId = parseInt(value);
                    setCurrentLevel(levelId);
                    loadLevel(levelId);
                    setGameWon(false);
                    setRunning(false);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map(level => (
                      <SelectItem key={level.id} value={level.id.toString()}>
                        {level.id}. {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button onClick={() => setShowInstructions(true)} title="View level instructions" className="text-slate-500 hover:text-slate-700 transition-colors">
                  <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm !text-slate-700">Preset</Label>
                <Select value={preset} onValueChange={setPreset}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem className="!text-slate-700" value="open">Open Field</SelectItem>
                    <SelectItem className="!text-slate-700" value="corridor">Corridor</SelectItem>
                    <SelectItem className="!text-slate-700" value="two-rooms">Two Rooms</SelectItem>
                    <SelectItem className="!text-slate-700" value="maze">Maze</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm !text-slate-700">Key Collected:</Label>
                <span className="text-sm text-slate-700">{hasKey ? 'Yes' : 'No'}</span>
              </div>
            <div className="grid grid-cols-1 lg:grid-cols-[auto,1fr] gap-2 sm:gap-4">
              <div className="overflow-x-auto lg:overflow-auto">
                <div className="relative select-none inline-block lg:inline-block" style={{ width: canvasW, height: canvasH, minWidth: `min(100vw - 32px, ${canvasW}px)` }}>
                {/* Static grid layer */}
                <StaticGrid
                  grid={grid}
                  gridW={gridW}
                  gridH={gridH}
                  cellSize={cellSize}
                  // cellBG={cellBG}
                  onCellClick={onCellClick}
                />

                {/* Agent overlay */}
                <motion.div
                  layoutId="agent"
                  className="absolute w-10 h-10 flex items-center justify-center text-3xl"
                  initial={false}
                  animate={{
                    left: agent.x * cellSize + (cellSize - 40) / 2,
                    top: agent.y * cellSize + (cellSize - 40) / 2,
                    scale: 1,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  🤠
                </motion.div>
                  </div>
              </div>

              <div className="flex flex-col rounded-2xl m-2 p-0 items-stretch justify-start">
                {/* <Card className="rounded-xl"> */}
                  <CardHeader>
                    <CardTitle className="text-center justify-center text-lg font-bold text-blue-800">Add new challenges!</CardTitle>
                  </CardHeader>
                  {/* <CardContent className="space-y-1"> */}

                    <div className="grid w-full grid-cols-[1fr_1fr_auto] items-end gap-2">
                      <div>
                        <Label className="mb-1 text-slate-700">Width</Label>
                        <Input type="number" min={4} max={30} value={gridWInput}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setGridWInput(e.target.value)}
                          onBlur={() => {
                            const parsed = parseInt(gridWInput, 10);
                            const next = Number.isFinite(parsed) ? clamp(parsed, 4, 30) : gridW;
                            setGridWInput(String(next));
                          }}
                          className="border-slate-700 text-slate-700 w-full"/>
                        {/* onChange={e=>setGridW(clamp(parseInt(e.target.value||"6"),4,30))}/> */}
                      </div>
                      <div>
                        <Label className="mb-1 text-slate-700">Height</Label>
                        <Input type="number" min={4} max={22} value={gridHInput}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setGridHInput(e.target.value)}
                            onBlur={() => {
                              const parsed = parseInt(gridHInput, 10);
                              const next = Number.isFinite(parsed) ? clamp(parsed, 4, 22) : gridH;
                              setGridHInput(String(next));
                            }}
                            className="border-slate-700 text-slate-700 w-full"/>
                            {/* onChange={e=>setGridH(clamp(parseInt(e.target.value||"6"),4,22))}/> */}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const wParsed = parseInt(gridWInput, 10);
                          const hParsed = parseInt(gridHInput, 10);
                          const nextW = Number.isFinite(wParsed) ? clamp(wParsed, 4, 30) : gridW;
                          const nextH = Number.isFinite(hParsed) ? clamp(hParsed, 4, 22) : gridH;
                          setGridW(nextW);
                          setGridH(nextH);
                          setGridWInput(String(nextW));
                          setGridHInput(String(nextH));
                        }}
                        className="w-full"
                      >
                        Apply
                      </Button>
                    </div>

                {/*<div className="flex-col grid grid-cols-3 gap-2 mt-3 ustify-center items-center">
                      <Button variant={tool==="draw"?"default":"outline"} onClick={()=>setTool("draw")}><MousePointer2 className="w-4 h-4 mr-1"/>Draw</Button>
                      <Button variant={tool==="pick"?"default":"outline"} onClick={()=>setTool("pick")}><Wand2 className="w-4 h-4 mr-1"/>Pick</Button>
                      <Button variant={tool==="erase"?"default":"outline"} onClick={()=>setTool("erase")}><Eraser className="w-4 h-4 mr-1"/>Erase</Button>
                    </div>*/}

                    <div className="flex-col grid grid-cols-5 gap-1 py-2 space-y-2 justify-center items-center text-xs">
                      {(["wall","empty","goal","lava","start"] as CellType[]).map(c => (
                        <button key={c} onClick={()=>{ setBrush(c); setTool("draw"); }} className={`rounded-md border p-1 m-1 ring-black text-slate-900`} style={{ background: cellBG(c) }}>{c}</button>
                      ))}
                    </div>

                    {/* <div className="flex items-center justify-between space-y-3 ">
                      <Label>Wind/Stochasticity</Label>
                      <Switch checked={wind} onCheckedChange={setWind} />
                    </div> */}

                  <div className="flex-row items-center justify-between space-y-4 w-full">
                    <SliderWithVal label="Steps/sec" min={1} max={40} step={1} value={speed} onChange={setSpeed} help="Speed of simulation. Higher values run more episodes per second."/>
                    <SliderWithVal label="Step cost" min={-0.2} max={0} step={0.01} value={stepCost} onChange={setStepCost} help="Penalty for each step taken. Negative values encourage the agent to find shorter paths to the goal." disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('stepCost')}/>
                    <SliderWithVal label="Goal reward" min={0.1} max={10} step={0.1} value={goalReward} onChange={setGoalReward} help="Positive reward received when the agent reaches the goal. Higher values make the goal more attractive." disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('goalReward')}/>
                    <SliderWithVal label="Lava penalty" min={-10} max={-0.1} step={0.1} value={lavaPenalty} onChange={setLavaPenalty} help="Negative reward for stepping into lava. More negative values make the agent strongly avoid lava." disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('lavaPenalty')}/>
                  </div>
                  {/* </CardContent> */}
                {/* </Card> */}

                {/* <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg">PS Parameters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SliderWithVal label="Memory damping (γ)" min={0.01} max={1} step={0.01} value={psGamma} onChange={setPsGamma}/>
                    <SliderWithVal label="Reward coupling (λ)" min={0} max={10} step={1} value={psLambda} onChange={setPsLambda}/>
                    <SliderWithVal label="Glow decay (η)" min={0} max={1} step={0.01} value={psGlowEta} onChange={setPsGlowEta}/>
                    <SliderWithVal label="Exploration (ε)" min={0} max={1} step={0.01} value={epsilon} onChange={setEpsilon}/>
                    <SliderWithVal label="Softmax temperature (β)" min={0.05} max={5} step={0.05} value={tau} onChange={setTau}/>
                    <div className="text-sm text-neutral-600">Episode: {episode} · Current G: {fmt(currentEpReturn)}</div>
                    <div className="text-xs text-neutral-500">Total return: {fmt(totalReturnRef.current)}</div>
                  </CardContent>
                </Card> */}

                {/* <RewardsPanel rewardTrace={rewardTrace} cumTrace={cumTrace} episodeReturns={episodeReturns} /> */}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl rounded-2xl xl:col-span-1 m-1 sm:m-2 p-2 order-2 lg:order-2" style={{ background: "#f5f5f5ff"}}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl sm:text-2xl text-slate-700 flex items-center justify-center gap-2"><Brain className="w-8 h-8 sm:w-10 sm:h-10"/> Memory of the PS Agent</CardTitle>
            <div className="mt-1 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPsInfo(true)}
                className="text-indigo-900 hover:text-indigo-950 underline underline-offset-4"
              >
                Learn more about projective simulation
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="w-84"><SliderWithVal label="Size of the grid" min={24} max={72} step={2} value={inspectorSize} onChange={setInspectorSize} help="Controls the visualization size of the memory/policy inspector grid. Larger = more detailed view of the learned policy."/></div>
              <PSInspectorErrorBoundary>
                <PSInspector key={psVersion} grid={grid} ps={psRef.current} cellSize={inspectorSize} />
              </PSInspectorErrorBoundary>
            </div>
          </CardContent>
          {/* <Card className="rounded-xl"> */}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-center justify-center text-lg font-bold text-blue-800">Tune the agent to make it learn!</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SliderWithVal
                        label="Memory damping (γ)"
                        min={0}
                        max={0.2}
                        step={0.001}
                        value={psGamma}
                        onChange={setPsGamma}
                        help={
                          <ul className="pl-4 space-y-1">
                            <p>How quickly the agent forgets connections between past experiences:</p><strong>
                            <li>Lower values = longer memory</li>
                            <li>Higher values = faster forgetting</li></strong>
                          </ul>
                        }
                      />
                    <SliderWithVal
                        label="Reward coupling (λ)"
                        min={0}
                        max={10}
                        step={0.5}
                        value={psLambda}
                        onChange={setPsLambda}
                        help={
                          <ul className="pl-4 space-y-1">
                            <p>Scales how strongly rewards influence learning:</p>
                            <li><strong> Higher values = bigger updates.</strong></li>
                          </ul>
                        } 
                      />
                    <SliderWithVal 
                        label="Glow decay (η)" 
                        min={0} 
                        max={1} 
                        step={0.001} 
                        value={psGlowEta} 
                        onChange={setPsGlowEta} 
                        help={
                          <ul className="pl-4 space-y-1">
                            <p>Controls how quickly temporary activation patterns fade. It enables the agent to learn in environments with sparse rewards:</p>
                            <strong>
                            <li>Higher values = Short memory of past actions</li>
                            <li>Smaller values = Keep track of more actions</li>      
                            </strong>
                          </ul>}
                        disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('psGlowEta')}/>

                    <SliderWithVal
                        label="Exploration (ε)" 
                        min={0} 
                        max={1} 
                        step={0.01} 
                        value={epsilon} 
                        onChange={setEpsilon} 
                        help={<ul className="pl-4 space-y-1">
                            <p>Probability of taking a random action instead of using learned policy. 
                              <strong>
                              <li>Higher values = more exploration and randomness.</li></strong></p>
                          </ul>}
                        disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('epsilon')}/>

                    {/* <SliderWithVal label="Memory damping (γ)" min={0} max={0.2} step={0.001} value={psGamma} onChange={setPsGamma} help="Controls how quickly the agent forgets past experiences. Lower values = better long-term memory, higher values = quick memory decay." disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('psGamma')}/> */}
                    {/* <SliderWithVal label="Reward coupling (λ)" min={0} max={10} step={1} value={psLambda} onChange={setPsLambda} help="Scales how strongly rewards influence learning. Higher values = stronger reward signals that update the agent's policy more aggressively." disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('psLambda')}/> */}
                    {/* <SliderWithVal label="Glow decay (η)" min={0} max={1} step={0.001} value={psGlowEta} onChange={setPsGlowEta} help="Controls how quickly temporary activation patterns fade. Controls the exploration-exploitation balance in the random walk." disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('psGlowEta')}/> */}
                    {/* <SliderWithVal label="Exploration (ε)" min={0} max={1} step={0.01} value={epsilon} onChange={setEpsilon} help="Probability of taking a random action instead of using learned policy. Higher values = more exploration and randomness." disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('epsilon')}/> */}
                    {/* <SliderWithVal label="Temperature parameter (β)" min={0.05} max={5} step={0.05} value={tau} onChange={setTau} help="Controls softmax randomness in action selection. Lower values = sharper action selection, higher values = softer/more random choices." disabled={!LEVELS.find(l => l.id === currentLevel)?.adjustableParams.includes('tau')}/> */}
                  </CardContent>
                {/* </Card> */}
        </Card>
        <Card className="xl:col-span-1 shadow-xl rounded-2xl m-1 sm:m-2 p-2 flex flex-col order-3 lg:order-3" style={{ background: "#f5f5f5ff"  }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl sm:text-2xl text-slate-700 flex items-center justify-center gap-2"><Trophy className="w-8 h-8 sm:w-10 sm:h-10"/>  Learning Curves</CardTitle>
          </CardHeader>   
          <CardContent className="space-y-2">
              <p className="text-sm text-neutral-600">Episode: {episode} · Current G: {fmt(currentEpReturn)} · Total return: {fmt(totalReturnRef.current)}</p>
              {/* <p className="text-xs text-neutral-500">Total return: {fmt(totalReturnRef.current)}</p> */}
            <RewardsPanel rewardTrace={rewardTrace} cumTrace={cumTrace} episodeReturns={episodeReturns} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function fmt(v:number){
  if (!Number.isFinite(v)) return "0.00";
  return (Math.round(v * 100) / 100).toFixed(2);
}

function cellBG(c: CellType){
  switch (c){
    case "wall": return "#cbd5e1";
    case "goal": return "#a7f3d0";
    case "lava": return "#fecaca";
    case "start": return "#fde68a";
    case "key": return "#acd2fe";
    case "door-closed": return "#a26323";
    case "door-open": return "#ffe7d6";
    default: return "#ffffff";
  }
}
