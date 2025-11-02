import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, AreaChart, Area, Label as ChartLabel } from "recharts";
import { Play, Pause, RotateCcw, Eraser, Wand2, MousePointer2, Brain, Bot, Sprout, Trophy} from "lucide-react";
import { motion } from "framer-motion";

const ACTIONS = ["up", "right", "down", "left"] as const;
type Action = typeof ACTIONS[number];

type CellType = "empty" | "wall" | "goal" | "lava" | "start";

type PointTR = { t: number; R: number };
type PointTC = { t: number; C: number };
type PointEG = { ep: number; G: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function psColor01(x: number) {
  const v = clamp(x, 0, 1);
  const b = 200 + Math.round(55 * v);
  const g = 200 + Math.round(30 * v);
  const r = 220 - Math.round(80 * v);
  return "#fbfaf3ff"
  // return `rgb(${r},${g},${b})`;
}

function makeGrid(w: number, h: number, preset: string): CellType[][] {
  const grid: CellType[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => "empty" as CellType));
  if (preset === "open") {
    grid[0][w - 1] = "goal";
    grid[h - 1][0] = "start";
    grid[h - 1][w - 2] = "lava";
  } else if (preset === "corridor") {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) grid[y][x] = y === Math.floor(h / 2) ? "empty" : "wall";
    grid[h - 1][0] = "start";
    grid[Math.floor(h / 2)][w - 1] = "goal";
  } else if (preset === "two-rooms") {
    const doorY = Math.floor(h / 2);
    for (let y = 0; y < h; y++) {
      if (y === doorY) continue;
      const mid = Math.floor(w / 2);
      grid[y][mid] = "wall";
    }
    grid[h - 1][1] = "start";
    grid[0][w - 2] = "goal";
    grid[h - 2][2] = "lava";
  } else if (preset === "maze") {
    for (let y = 1; y < h - 1; y += 2) {
      for (let x = 1; x < w - 1; x++) grid[y][x] = "wall";
      const gap = 1 + ((y * 3) % (w - 2));
      grid[y][gap] = "empty";
    }
    grid[h - 1][0] = "start";
    grid[0][w - 1] = "goal";
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
  return{x:x+1,y};
}

function SliderWithVal({ label, min, max, step=1, value, onChange }: { label: string, min: number, max: number, step?: number, value: number, onChange: (v:number)=>void }){
  return (
    <div>
      <div className="flex items-center justify-between mb-1"><Label>{label}</Label><span className="text-xs text-neutral-600">{typeof value==="number"? value.toFixed(2): value}</span></div>
      <Slider min={min} max={max} step={step} value={[value as number]} onValueChange={(v)=>onChange(v[0])} />
    </div>
  );
}

function PSInspector({
  gridW,
  gridH,
  grid,
  ps,
  cellSize,
}: {
  gridW: number;
  gridH: number;
  grid: CellType[][];
  ps: PSLayer;
  cellSize: number;
}) {
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className="overflow-auto">
      <div className="inline-block border rounded-xl">
        {Array.from({ length: gridH }).map((_, y) => (
          <div key={`pi-${y}`} className="flex">
            {Array.from({ length: gridW }).map((__, x) => {
              const c = grid[y][x];
              const isWall = c === "wall";

              // Walls: no policy arrows, just gray
              if (isWall) {
                return (
                  <div
                    key={`pi-${x}-${y}`}
                    className="border border-neutral-300"
                    style={{
                      width: cellSize,
                      height: cellSize,
                      background: "#20262dff",
                    }}
                  />
                );
              }

              // Compute normalized probabilities
              const hVals = [0, 1, 2, 3].map((a) => ps.getH(x, y, a));
              const sumH = hVals.reduce((a, b) => a + b, 0) || 1;
              const probs = hVals.map((h) => h / sumH); // normalized
              const hAvg = hVals.reduce((a, b) => a + b, 0) / 4;
              const hNorm = clamp((hAvg - 1) / (3 - 1), 0, 1);
              const bg = psColor01(hNorm);

              // Glow visualization
              let glow = 0;
              for (let a = 0; a < 4; a++)
                glow = Math.max(glow, ps.getG(x, y, a));
              const ringOpacity = clamp(glow / 2, 0, 0.7);

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
                        <path d="M0,0 L0,4 L4,2 Z" fill="indigo" />
                      </marker>
                    </defs>

                    {(() => {
                      const center = 50;
                      const arrowLen = 30; // constant arrow length
                      const strokeW = 4; // constant arrow thickness

                      // Utility to draw arrow with opacity = probability
                      const drawArrow = (
                        dx: number,
                        dy: number,
                        p: number
                      ) => {
                        const x1 = center;
                        const y1 = center;
                        const x2 = center + dx * arrowLen;
                        const y2 = center + dy * arrowLen;
                        return (
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="indigo"
                            strokeWidth={strokeW}
                            markerEnd="url(#arrowhead)"
                            strokeLinecap="round"
                            opacity={p} // fade with strength
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
                  {c === "goal" && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      🏁
                    </span>
                  )}
                  {c === "lava" && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      🔥
                    </span>
                  )}
                  {c === "start" && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                      🟢
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {hover && (
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
    <Card className="rounded-xl">
      <CardHeader><CardTitle className="text-lg">Rewards</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="h-64 mb-14 overflow-visible">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rewardTrace} margin={{ top: 30, right: 0, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" width={60}><ChartLabel value="Time Step" offset={-5} textAnchor="middle" dominantBaseline="central" position="bottom"/></XAxis>
              <YAxis dataKey="R" width={60}><ChartLabel value="Instantaneous Reward" dx={5} dy={-75} textAnchor="middle" dominantBaseline="central" position="left" angle={-90}/></YAxis>
              <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l)=>`t=${l}`}/>
              <Line type="monotone" dataKey="R" strokeWidth={2} dot={false} isAnimationActive={false}/>
              <ChartLabel value="Instantaneous Reward Over Time (R)" position="top" offset={10}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="h-64 mb-14 overflow-visible">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={cumTrace} margin={{ top: 30, right: 0, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" width={60}><ChartLabel value="Time Step" offset={-5} textAnchor="middle" dominantBaseline="central" position="bottom"/></XAxis>
              <YAxis dataKey="C" width={60}><ChartLabel value="Cumulative Reward" dx={5} dy={-60} textAnchor="middle" dominantBaseline="central" position="left" angle={-90}/></YAxis>
              <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l)=>`t=${l}`}/>
              <Area type="monotone" dataKey="C" strokeWidth={2} fillOpacity={0.2}/>
              <ChartLabel value="Cumulative Reward Over Time (C)" position="top" offset={10}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="h-64 overflow-visible">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={episodeReturns} margin={{ top: 30, right: 0, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="ep" width={60}><ChartLabel value="Episode Number" offset={-5} textAnchor="middle" dominantBaseline="central" position="bottom"/></XAxis>
              <YAxis dataKey="G" width={60}><ChartLabel value="Episode Return" dx={5} dy={-50} textAnchor="middle" dominantBaseline="central" position="left" angle={-90}/></YAxis>
              <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l)=>`ep=${l}`}/>
              <Line type="monotone" dataKey="G" strokeWidth={2} dot={false} isAnimationActive={false}/>
              <ChartLabel value="Episode Return Per Episode (G)" position="top" offset={10}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default function InteractiveRLLab(){
  const [gridW,setGridW]=useState(5);
  const [gridH,setGridH]=useState(5);
  const [preset,setPreset]=useState("open");
  const [grid,setGrid]=useState<CellType[][]>(()=>makeGrid(6,6,"open"));
  const [startPos,setStartPos]=useState<{x:number,y:number}>(()=>({x:0,y:5}));
  const [agent,setAgent]=useState<{x:number,y:number}>({x:startPos.x,y:startPos.y});
  const [episode,setEpisode]=useState(1);
  const [running,setRunning]=useState(true);
  const [speed,setSpeed]=useState(12);
  const [stepCost,setStepCost]=useState(-0.01);
  const [goalReward,setGoalReward]=useState(1);
  const [lavaPenalty,setLavaPenalty]=useState(-1);
  const [wind,setWind]=useState(false);
  const [psLambda,setPsLambda]=useState(1);
  const [psGamma,setPsGamma]=useState(0.01);
  const [psGlowEta,setPsGlowEta]=useState(0.05);
  const [epsilon,setEpsilon]=useState(0.1);
  const [tau,setTau]=useState(1);
  const [rewardTrace,setRewardTrace]=useState<PointTR[]>([]);
  const [cumTrace,setCumTrace]=useState<PointTC[]>([]);
  const [episodeReturns,setEpisodeReturns]=useState<PointEG[]>([]);
  const [currentEpReturn,setCurrentEpReturn]=useState(0);
  const tRef=useRef(0);
  const totalReturnRef=useRef(0);
  const currentEpReturnRef=useRef(0);
  const psRef=useRef<PSLayer>(new PSLayer(gridW,gridH));
  const gridRef=useRef(grid); useEffect(()=>{gridRef.current=grid},[grid]);
  const agentRef=useRef(agent); useEffect(()=>{agentRef.current=agent},[agent]);
  const startPosRef=useRef(startPos); useEffect(()=>{startPosRef.current=startPos},[startPos]);
  const windRef=useRef(wind); useEffect(()=>{windRef.current=wind},[wind]);
  const psLambdaRef=useRef(psLambda); useEffect(()=>{psLambdaRef.current=psLambda},[psLambda]);
  const psGammaRef=useRef(psGamma); useEffect(()=>{psGammaRef.current=psGamma},[psGamma]);
  const psGlowEtaRef=useRef(psGlowEta); useEffect(()=>{psGlowEtaRef.current=psGlowEta},[psGlowEta]);
  const epsilonRef=useRef(epsilon); useEffect(()=>{epsilonRef.current=epsilon},[epsilon]);
  const tauRef=useRef(tau); useEffect(()=>{tauRef.current=tau},[tau]);
  const stepCostRef=useRef(stepCost); useEffect(()=>{stepCostRef.current=stepCost},[stepCost]);
  const goalRewardRef=useRef(goalReward); useEffect(()=>{goalRewardRef.current=goalReward},[goalReward]);
  const lavaPenaltyRef=useRef(lavaPenalty); useEffect(()=>{lavaPenaltyRef.current=lavaPenalty},[lavaPenalty]);

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

  useEffect(()=>{
    if(!running) return;
    const interval=setInterval(()=>{tick();},Math.max(20,1000/Math.max(1,speed)));
    return()=>clearInterval(interval);
  },[running,speed]);

  function envReward(x:number,y:number){
    const c=gridRef.current[y]?.[x];
    if(c==="goal")return goalRewardRef.current;
    if(c==="lava")return lavaPenaltyRef.current;
    if(c==="wall")return -0.2;
    return stepCostRef.current;
  }

  function isTerminal(x:number,y:number){
    const c=gridRef.current[y]?.[x];
    return c==="goal"||c==="lava";
  }

  function legal(x:number,y:number){
    return x>=0&&y>=0&&x<gridW&&y<gridH&&gridRef.current[y][x]!=="wall";
  }

  function windJitter(a:number){
    if(!windRef.current) return a;
    const r=Math.random();
    if(r<0.1) return (a+1)%4;
    if(r<0.2) return (a+3)%4;
    return a;
  }

  function pickAction(x:number,y:number){
    if (Math.random() < epsilonRef.current) return Math.floor(Math.random()*4);
    let hs:number[] = new Array(4).fill(0);
    for (let a=0;a<4;a++) hs[a]=psRef.current.getH(x,y,a);
    const t=Math.max(0.01, tauRef.current);
    const maxH=Math.max(...hs);
    const exps=hs.map(h=>Math.exp((h-maxH)/t));
    const sum=exps.reduce((a,b)=>a+b,0);
    let r=Math.random(); let acc=0;
    for(let a=0;a<4;a++){acc+=exps[a]/sum; if(r<=acc)return a;}
    return 0;
  }

  function attemptMove(x:number,y:number,a:number){
    const next=stepXY(x,y,ACTIONS[windJitter(a)]);
    if(!legal(next.x,next.y))return{x,y};
    return next;
  }

  function restartEpisode(lastReward:number){
    const G=currentEpReturnRef.current+lastReward;
    setEpisodeReturns(l => [...l, { ep: (l.length ? l[l.length - 1].ep + 1 : 1), G }]);
    setEpisode(e=>e+1);
    setCurrentEpReturn(0);
    currentEpReturnRef.current=0;
    setAgent(startPosRef.current);
    agentRef.current=startPosRef.current;
    psRef.current.gvals.fill(0);
  }

  function tick(){
    const {x,y}=agentRef.current;
    const a=pickAction(x,y);
    psRef.current.decayGlow(psGlowEtaRef.current);
    psRef.current.addGlow(x,y,a,1);
    const s1=attemptMove(x,y,a);
    const r=envReward(s1.x,s1.y);
    psRef.current.rewardUpdate(r,psGammaRef.current,psLambdaRef.current);
    psRef.current.normalize();
    tRef.current+=1;
    totalReturnRef.current+=r;
    setRewardTrace(tr=>{const nxt=[...tr,{t:tRef.current,R:r}]; return nxt.length>10?nxt.slice(-10):nxt;});
    setCumTrace(ct=>{const nxt=[...ct,{t:tRef.current,C:totalReturnRef.current}]; return nxt.length>1000?nxt.slice(-1000):nxt;});
    setCurrentEpReturn(v=>v+r);
    setAgent(s1);
    agentRef.current=s1;
    if(isTerminal(s1.x,s1.y)) restartEpisode(r);
  }

  const cellSize=36;
  const [inspectorSize,setInspectorSize]=useState(60);
  const canvasW=gridW*cellSize;
  const canvasH=gridH*cellSize;
  const [tool,setTool]=useState<"draw"|"pick"|"erase">("draw");
  const [brush,setBrush]=useState<CellType>("wall");

  function onCellClick(x:number,y:number){
    if(tool==="pick"){ setBrush(gridRef.current[y][x]); return; }
    const b = tool==="erase"?"empty":brush;
    const g = gridRef.current.map(row=>[...row]);
    g[y][x]=b;
    setGrid(g);
    if(b==="start"){ setStartPos({x,y}); setAgent({x,y}); agentRef.current={x,y}; }
  }

  return (
    <div className="w-screen min-h-screen bg-neutral-100 flex flex-col">
    <Card className="border-slate-100 p-1 m-1">
    <CardHeader className="flex items-center justify-center">
    <div>
    <CardTitle className="text-3xl items-center flex justify-center gap-2"><Bot className="w-10 h-10"/> Interactive Reinforcement Learning Lab </CardTitle>
    <p className="text-xl text-slate-500 mt-1"> Come and train your reinforcement learnng agent in real life!</p>
    </div>
    <div className="flex items-center gap-2">
    <Button
          variant={running ? "secondary" : "default"}
          onClick={() => setRunning(r => !r)}
        >
          {running ? (
            <>
              <Pause className="w-4 h-4 mr-1" /> Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" /> Run
            </>
          )}
    </Button>

    <Button
        variant="outline"
        onClick={() => {
          // Reset everything:
          setAgent(startPosRef.current);
          agentRef.current = startPosRef.current;
          setEpisode(1);
          setRewardTrace([]);
          setCumTrace([]);
          setEpisodeReturns([]);
          setCurrentEpReturn(0);
          tRef.current = 0;
          totalReturnRef.current = 0;
          currentEpReturnRef.current = 0;
          psRef.current = new PSLayer(gridW, gridH); // reset memory!
        }}
      >
        <RotateCcw className="w-4 h-4 mr-1" /> Reset Agent
    </Button>
    </div>
    </CardHeader>
    </Card>

      <div className="max-w-20xl mx-auto grid grid-cols-3 gap-4 p-4">
        <Card className="xl:col-span-1 shadow-xl rounded-2xl m-1 p-1">
          <CardHeader className="flex items-center justify-center">
            <CardTitle className="text-2xl flex items-center justify-between gap-2"><Sprout className="w-10 h-10"/> Build your environment!</CardTitle>
          </CardHeader>
          <CardContent>
              <Label className="text-sm">Preset</Label>
                  <Select value={preset} onValueChange={setPreset}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open Field</SelectItem>
                      <SelectItem value="corridor">Corridor</SelectItem>
                      <SelectItem value="two-rooms">Two Rooms</SelectItem>
                      <SelectItem value="maze">Maze</SelectItem>
                    </SelectContent>
                  </Select>
            <div className="grid md:grid-cols-[auto,300px] gap-4">
              <div className="overflow-auto">
                <div className="relative select-none" style={{ width: canvasW, height: canvasH }}>
                  {Array.from({ length: gridH }).map((_, y) => (
                    <div key={y} className="flex">
                      {Array.from({ length: gridW }).map((__, x) => (
                        <div
                          key={`${x}-${y}`}
                          onMouseDown={(e) => { e.preventDefault(); onCellClick(x,y); }}
                          onMouseEnter={(e)=>{ if (e.buttons===1) onCellClick(x,y); }}
                          className="border border-neutral-300 flex items-center justify-center"
                          style={{ width: cellSize, height: cellSize, background: cellBG(gridRef.current[y][x]) }}
                          title={`(${x},${y})`}
                        >
                          {agent.x===x && agent.y===y && (
                            <motion.div layoutId="agent" className="w-6 h-6 rounded-full shadow" initial={false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20 }} style={{ background: "black" }} />
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg">Environment</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Label className="text-sm">Preset</Label>
                    <Select value={preset} onValueChange={setPreset}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open Field</SelectItem>
                        <SelectItem value="corridor">Corridor</SelectItem>
                        <SelectItem value="two-rooms">Two Rooms</SelectItem>
                        <SelectItem value="maze">Maze</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="grid grid-cols-2 gap-2 items-center">
                      <div>
                        <Label>Width</Label>
                        <Input type="number" min={4} max={30} value={gridW} onChange={e=>setGridW(clamp(parseInt(e.target.value||"6"),4,30))}/>
                      </div>
                      <div>
                        <Label>Height</Label>
                        <Input type="number" min={4} max={22} value={gridH} onChange={e=>setGridH(clamp(parseInt(e.target.value||"6"),4,22))}/>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <Button variant={tool==="draw"?"default":"outline"} onClick={()=>setTool("draw")}><MousePointer2 className="w-4 h-4 mr-1"/>Draw</Button>
                      <Button variant={tool==="pick"?"default":"outline"} onClick={()=>setTool("pick")}><Wand2 className="w-4 h-4 mr-1"/>Pick</Button>
                      <Button variant={tool==="erase"?"default":"outline"} onClick={()=>setTool("erase")}><Eraser className="w-4 h-4 mr-1"/>Erase</Button>
                    </div>

                    <div className="grid grid-cols-5 gap-2 text-xs">
                      {(["wall","empty","goal","lava","start"] as CellType[]).map(c => (
                        <button key={c} onClick={()=>{ setBrush(c); setTool("draw"); }} className={`rounded-md border p-2 ring-black`} style={{ background: cellBG(c) }}>{c}</button>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Wind/Stochasticity</Label>
                      <Switch checked={wind} onCheckedChange={setWind} />
                    </div>

                    <SliderWithVal label="Steps/sec" min={1} max={40} step={1} value={speed} onChange={setSpeed} />
                    <SliderWithVal label="Step cost" min={-0.2} max={0} step={0.01} value={stepCost} onChange={setStepCost} />
                    <SliderWithVal label="Goal reward" min={0.1} max={10} step={0.1} value={goalReward} onChange={setGoalReward} />
                    <SliderWithVal label="Lava penalty" min={-10} max={-0.1} step={0.1} value={lavaPenalty} onChange={setLavaPenalty} />
                  </CardContent>
                </Card>

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

        <Card className="shadow-xl rounded-2xl xl:col-span-1 m-1 p-1">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center justify-center gap-2"><Brain className="w-10 h-10"/> Memory of the PS Agent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="w-84"><SliderWithVal label="Inspector size" min={24} max={72} step={2} value={inspectorSize} onChange={setInspectorSize} /></div>
              <PSInspector gridW={gridW} gridH={gridH} grid={grid} ps={psRef.current} cellSize={inspectorSize} />
            </div>
          </CardContent>
          {/* <Card className="rounded-xl"> */}
                  <CardHeader>
                    <CardTitle className="text-lg">PS Parameters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SliderWithVal label="Memory damping (γ)" min={0.01} max={1} step={0.01} value={psGamma} onChange={setPsGamma}/>
                    <SliderWithVal label="Reward coupling (λ)" min={0} max={10} step={1} value={psLambda} onChange={setPsLambda}/>
                    <SliderWithVal label="Glow decay (η)" min={0} max={1} step={0.01} value={psGlowEta} onChange={setPsGlowEta}/>
                    <SliderWithVal label="Exploration (ε)" min={0} max={1} step={0.01} value={epsilon} onChange={setEpsilon}/>
                    <SliderWithVal label="Softmax temperature (β)" min={0.05} max={5} step={0.05} value={tau} onChange={setTau}/>
                  </CardContent>
                {/* </Card> */}
        </Card>
        <Card className="xl:col-span-1 shadow-xl rounded-2xl m-1 p-1">
          <CardHeader className="flex items-center justify-center">
            <CardTitle className="text-2xl flex items-center justify-center gap-2"><Trophy className="w-10 h-10"/>  Learning curves</CardTitle>
          </CardHeader>   
          <CardContent className="space-y-1">
              <p className="text-sm text-neutral-600">Episode: {episode} · Current G: {fmt(currentEpReturn)}</p>
              <p className="text-xs text-neutral-500">Total return: {fmt(totalReturnRef.current)}</p>
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
    default: return "#ffffff";
  }
}
