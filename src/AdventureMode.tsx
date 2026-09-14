import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Compass,
  Eye,
  Footprints,
  GraduationCap,
  Home,
  Lightbulb,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import Nova_standing from "./assets/Nova_Standing_noBackground.png";
import Nova_face from "./assets/Nova_Face.png";

type Point = { x: number; y: number };
type Action = "up" | "right" | "down" | "left";
type MemoryCell = { h: number[]; glow: number[] };
type Memory = MemoryCell[][];
type MemoryView = "glow" | "h" | "policy";

const GRID_SIZE = 5;
const START = { x: 0, y: 4 };
const WATCH = { x: 4, y: 0 };
const FINAL_REWARD = 5;
const PRACTICE_GLOW_RETENTION = 0.9;
const ACTIONS: Action[] = ["up", "right", "down", "left"];
const ARROWS = ["↑", "→", "↓", "←"];
const ACTION_COLORS = ["#256d55", "#376bb5", "#d2764e", "#7357a6"];
const CELL_OBJECTS = [
  "💡", "📕", "🧸", "🌸", "⌚",
  "🔑", "🪁", "🧲", "🍎", "🎨",
  "📚", "🌱", "🧵", "🔍", "🎀",
  "🎸", "🧭", "☂️", "💎", "🧺",
  "🎒", "🍒", "🔔", "✏️", "🌻",
];
const LEVEL_TITLES = ["Welcome, Coach", "The Percept–Action Loop", "How One Trip Teaches", "Practice Makes Memory"];
function makeMemory(): Memory {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({
      // Up and right are favored, while down and left remain plausible choices.
      h: [2.4, 2.4, 1, 1],
      glow: [0, 0, 0, 0],
    })),
  );
}

function copyMemory(memory: Memory): Memory {
  return memory.map((row) => row.map((cell) => ({ h: [...cell.h], glow: [...cell.glow] })));
}

function move(point: Point, action: Action): Point {
  const next = { ...point };
  if (action === "up") next.y -= 1;
  if (action === "right") next.x += 1;
  if (action === "down") next.y += 1;
  if (action === "left") next.x -= 1;
  next.x = Math.max(0, Math.min(GRID_SIZE - 1, next.x));
  next.y = Math.max(0, Math.min(GRID_SIZE - 1, next.y));
  return next;
}

function policy(values: number[]) {
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  return values.map((value) => value / total);
}

function perceptColor(x: number, y: number) {
  const colors = ["#bcebd4", "#c8dcff", "#ffe0a3", "#d9ccff", "#ffc8d0"];
  return colors[(x + y * 2) % colors.length];
}

function CharacterSlot({ kind = "student", compact = false }: { kind?: "guide" | "student"; compact?: boolean }) {
  return (
    <div className={`character-slot ${compact ? "character-slot-compact" : ""}`} aria-label={kind === "guide" ? "Nova standing" : "Detective student"}>
      <div className={`character-art ${kind === "guide" ? "nova-standing-art" : ""}`}>
        {kind === "student" ? <GraduationCap /> : <img src={Nova_standing} alt="Nova standing"  />}
      </div>
      {!compact && (
        <div className="character-caption">
          <span>Detective student Nova</span>
          <small>{kind === "guide" ? "Your new detective student" : "Detective in training"}</small>
        </div>
      )}
    </div>
  );
}

function NovaFaceMedal() {
  return (
    <div className="nova-face-medal" aria-label="Nova portrait">
      <img src={Nova_face} alt="Nova" />
    </div>
  );
}

function AdventureGrid({
  agent,
  trail = [],
  active = true,
}: {
  agent: Point;
  trail?: Point[];
  active?: boolean;
}) {
  return (
    <div className="adventure-grid" aria-label="Five by five detective training grid">
      {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
        const x = index % GRID_SIZE;
        const y = Math.floor(index / GRID_SIZE);
        const isAgent = x === agent.x && y === agent.y;
        const isWatch = x === WATCH.x && y === WATCH.y;
        const visited = trail.some((point) => point.x === x && point.y === y);
        const cellColor = perceptColor(x, y);
        return (
          <div
            className={`adventure-cell ${visited ? "visited" : ""}`}
            style={{ background: cellColor }}
            key={`${x}-${y}`}
            aria-label={`Color percept at row ${y + 1}, column ${x + 1}`}
          >
            <span
              className="cell-object"
              style={{ background: cellColor }}
              aria-label={isWatch ? "The lost watch" : `Object: ${CELL_OBJECTS[index]}`}
              title={isWatch ? "The lost watch" : undefined}
            >
              {CELL_OBJECTS[index]}
            </span>
            {isAgent && (
              <span className={`student-token ${active ? "student-active" : ""}`} title="Detective student Nova">
                <Search />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MemoryGrid({
  memory,
  view,
  focus,
  highlightUpdates = false,
  showValues = true,
  colorActions = false,
  glowColor = "green",
  emphasizeStrength = false,
  showAgent = false,
}: {
  memory: Memory;
  view: MemoryView;
  focus?: Point;
  highlightUpdates?: boolean;
  showValues?: boolean;
  colorActions?: boolean;
  glowColor?: "green" | "red";
  emphasizeStrength?: boolean;
  showAgent?: boolean;
}) {
  return (
    <div className="memory-grid" aria-label={`Agent memory shown as ${view}`}>
      {memory.flatMap((row, y) =>
        row.map((cell, x) => {
          const values = view === "policy" ? policy(cell.h) : view === "h" ? cell.h : cell.glow;
          const max = Math.max(...values);
          const focused = focus?.x === x && focus?.y === y;
          const cellGlow = Math.max(...cell.glow);
          const updatedCell = highlightUpdates && view === "h" && cellGlow > 0.02;
          return (
            <div
              className={`memory-cell ${focused ? "memory-focus" : ""} ${updatedCell ? "memory-updated" : ""}`}
              style={{
                "--cell-glow": Math.min(1, cellGlow),
                "--glow-rgb": glowColor === "green" ? "29, 165, 111" : "220, 92, 63",
              } as CSSProperties}
              key={`${x}-${y}`}
            >
              {values.map((value, action) => {
                const opacity = view === "glow" ? Math.max(0.16, Math.min(1, value)) : 0.35 + (value / (max || 1)) * 0.65;
                const updatedEdge = updatedCell && cell.glow[action] > 0.02;
                const arrowColor = colorActions
                  ? ACTION_COLORS[action]
                  : view === "glow"
                    ? glowColor === "green" ? "#1da56f" : "#dc5c3f"
                    : undefined;
                const strength = value / (max || 1);
                return (
                  <span
                    className={`memory-arrow memory-arrow-${action} ${updatedEdge ? "updated-edge" : ""}`}
                    style={{
                      opacity,
                      color: arrowColor,
                      "--arrow-stroke": emphasizeStrength ? `${Math.max(0, strength - 0.45) * 2.2}px` : "0px",
                    } as CSSProperties}
                    key={action}
                    title={`${ACTIONS[action]}: ${value.toFixed(2)}`}
                  >
                    <span className="memory-arrow-glyph">{ARROWS[action]}</span>
                    {showValues && <small>{view === "policy" ? `${Math.round(value * 100)}%` : value.toFixed(1)}</small>}
                  </span>
                );
              })}
              {showAgent && focused && <img className="memory-agent-marker" src={Nova_face} alt="Nova’s current position" />}
            </div>
          );
        }),
      )}
    </div>
  );
}

function ProbabilityInset({ probabilities }: { probabilities: number[] }) {
  const [mode, setMode] = useState<"bars" | "beads">("bars");
  const beadCounts = probabilities.map((chance) => Math.round(chance * 44));
  const beads = Array.from({ length: 44 }, (_, index) => {
    const target = (index * 17) % 44;
    let boundary = 0;
    return beadCounts.findIndex((count) => {
      boundary += count;
      return target < boundary;
    });
  });

  return (
    <aside className="probability-inset">
      <div className="probability-heading">
        <div><strong>Probability explorer</strong><small>Two ways to see the same chances</small></div>
        <div className="probability-switch" role="tablist" aria-label="Probability visualization">
          <button className={mode === "bars" ? "active" : ""} onClick={() => setMode("bars")}>Bars</button>
          <button className={mode === "beads" ? "active" : ""} onClick={() => setMode("beads")}>Beads</button>
        </div>
      </div>
      {mode === "bars" ? (
        <div className="probability-bars">
          {probabilities.map((chance, index) => (
            <div className="probability-bar" key={ACTIONS[index]}>
              <span>{ARROWS[index]} {ACTIONS[index]}</span>
              <i><b style={{ width: `${chance * 100}%`, background: ACTION_COLORS[index] }} /></i>
              <strong>{Math.round(chance * 100)}%</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="bead-view">
          <div className="bead-jar" aria-label="A jar of colored action beads">
            {beads.map((action, index) => <i style={{ background: ACTION_COLORS[action] }} key={index} />)}
          </div>
          <p>If Nova draws one bead without looking, colors that appear more often are more likely to be selected.</p>
        </div>
      )}
      <div className="action-legend">
        {ACTIONS.map((action, index) => <span key={action}><i style={{ background: ACTION_COLORS[index] }} />{ARROWS[index]} {action}</span>)}
      </div>
    </aside>
  );
}

function SampleHistogram({ counts }: { counts: number[] }) {
  const total = counts.reduce((sum, count) => sum + count, 0);

  return (
    <div className="sample-histogram" aria-label={`Histogram of ${total} sampled actions`}>
      <div className="sample-histogram-heading">
        <strong>Nova’s sampled actions</strong>
        <span>{total} {total === 1 ? "sample" : "samples"}</span>
      </div>
      {counts.map((count, index) => {
        const frequency = total ? count / total : 0;
        return (
          <div className="sample-histogram-row" key={ACTIONS[index]}>
            <span style={{ color: ACTION_COLORS[index] }}>{ARROWS[index]} {ACTIONS[index]}</span>
            <i><b style={{ width: `${frequency * 100}%`, background: ACTION_COLORS[index] }} /></i>
            <strong>{Math.round(frequency * 100)}%</strong>
          </div>
        );
      })}
    </div>
  );
}

function MemoryTabs({ value, onChange }: { value: MemoryView; onChange: (view: MemoryView) => void }) {
  return (
    <div className="memory-tabs" role="tablist" aria-label="Memory representation">
      {(["glow", "h", "policy"] as MemoryView[]).map((view) => (
        <button className={value === view ? "active" : ""} onClick={() => onChange(view)} key={view} role="tab">
          {view === "glow" ? "Glow" : view === "h" ? "H-values" : "Policy"}
        </button>
      ))}
    </div>
  );
}

type QuizConfig = {
  eyebrow: string;
  question: string;
  answers: string[];
  correct: number;
  explanation: string;
};

function QuizModal({
  config,
  onBack,
  onContinue,
  final = false,
}: {
  config: QuizConfig;
  onBack: () => void;
  onContinue: () => void;
  final?: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const correct = selected === config.correct;
  return (
    <div className="quiz-backdrop" role="dialog" aria-modal="true" aria-labelledby="quiz-title">
      <div className="quiz-card">
        <div className="quiz-badge"><CircleHelp /> {config.eyebrow}</div>
        <h2 id="quiz-title">{config.question}</h2>
        <div className="quiz-answers">
          {config.answers.map((answer, index) => (
            <button
              className={`${selected === index ? "selected" : ""} ${selected !== null && index === config.correct ? "correct" : ""}`}
              onClick={() => setSelected(index)}
              key={answer}
            >
              <span>{String.fromCharCode(65 + index)}</span>{answer}
            </button>
          ))}
        </div>
        {selected !== null && (
          <div className={`quiz-feedback ${correct ? "is-correct" : ""}`}>
            {correct ? <Check /> : <Lightbulb />}
            <p><strong>{correct ? "Exactly!" : "Not quite yet."}</strong> {config.explanation}</p>
          </div>
        )}
        <div className="quiz-actions">
          <button className="button-secondary" onClick={onBack}><ArrowLeft /> Previous lesson</button>
          <button className="button-primary" onClick={onContinue} disabled={!correct}>
            {final ? "Open Lab mode" : "Next lesson"} <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

const QUIZZES: QuizConfig[] = [
  {
    eyebrow: "Case note 1 of 3",
    question: "How does Nova choose an action from memory?",
    answers: [
      "The strongest arrow always wins",
      "The stronger the arrow, the more chances to choose (sample) the corresponding action.",
      "The watch tells Nova where to move",
    ],
    correct: 1,
    explanation: "Nova turns the four weights into chances. A stronger arrow is more likely, but it is not guaranteed to be chosen.",
  },
  {
    eyebrow: "Case note 2 of 3",
    question: "What job does glow do during a trajectory?",
    answers: [
      "It marks recent choices so a later reward can strengthen them",
      "It changes the color of the environment",
      "It guarantees the shortest path immediately",
    ],
    correct: 0,
    explanation: "Glow is a temporary trail in memory that fades away with time. When the watch is found, edges that glow more receive more credit.",
  },
  {
    eyebrow: "Final academy check",
    question: "What happens when forgetting is very fast?",
    answers: [
      "Old improvements fade quickly unless useful trips are repeated",
      "Every action keeps its strongest value forever",
      "Nova stops using probabilities",
    ],
    correct: 0,
    explanation: "Repetition consolidates a useful route, while forgetting continuously pulls unused connections back toward their starting value.",
  },
];

function WelcomeLevel({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <section className="story-page">
      <div className="story-copy">
        <span className="story-eyebrow"><Compass /> A new case has arrived</span>
        <h1>Welcome to the Detective Academy, Coach!</h1>
        <p className="story-lead">
          You are in charge of a new student of the Detective Academy, <strong>Nova</strong>. Guide her in the acquisition of her first detective skill: recovering lost objects.
        </p>
        <div className="story-note">
          <Sparkles />
          <p><strong>Your task:</strong> Train Nova and give her her first detective lesson!</p>
        </div>
        <p>
          Today’s mystery is a lost watch hidden in a place Nova never saw. You won’t tell Nova where to find the watch.
          Instead, you’ll help her to discover it with trials and errors and you will reward her everytime she finds the watch.
        </p>
        <div className="story-actions">
          <button className="button-primary" onClick={onNext}>Meet Nova <ArrowRight /></button>
          <button className="button-text" onClick={onSkip}>Skip the story</button>
        </div>
      </div>
      <CharacterSlot kind="guide" />
    </section>
  );
}

function LoopLevel({ onPrevious, onComplete }: { onPrevious: () => void; onComplete: () => void }) {
  const [phase, setPhase] = useState<"environment" | "memory">("environment");
  const [sampled, setSampled] = useState<number | null>(null);
  const [sampleCounts, setSampleCounts] = useState<number[]>([0, 0, 0, 0]);
  const [showQuiz, setShowQuiz] = useState(false);
  const memory = useMemo(makeMemory, []);
  const startPolicy = policy(memory[START.y][START.x].h);
  const agent = sampled === null ? START : move(START, ACTIONS[sampled]);

  function sampleAction() {
    const random = Math.random();
    let cumulative = 0;
    let choice = 0;
    startPolicy.some((chance, index) => {
      cumulative += chance;
      if (random <= cumulative) {
        choice = index;
        return true;
      }
      return false;
    });
    setSampled(choice);
    setSampleCounts((current) => current.map((count, index) => count + (index === choice ? 1 : 0)));
  }

  return (
    <section className="lesson-page">
        <div className="lesson-intro lesson-intro-row">
        <div><span className="story-eyebrow"><Footprints /> Lesson 1 · See and Act</span><h1>The percept–action loop</h1></div>
        <NovaFaceMedal />
      </div>
      <p className="lesson-summary">This is a mess! Help Nova to find the watch in this chaos. Nova can see the color and content of each cell, and she can decide where to move next. Everything Nova sees is called a <strong>percept</strong>. Based on the current percept, Nova can choose an <strong>action</strong>: after she moves and changes position, she has access to the next percept (color and object).</p>


      <div className="loop-layout">
        <div className={`lesson-panel ${phase === "environment" ? "panel-active" : ""}`}>
          <div className="panel-heading"><span>1</span><div><strong>Training room </strong><small>The environment: what Nova can see and affect.</small></div></div>
          <div className="instruction-strip"><Eye /><span><strong>Look first:</strong> find Nova, the watch, and the colored percepts.</span></div>
          <AdventureGrid agent={agent} />
          <div className="loop-key"><span className="mini-student"><Search /></span> Student at bottom-left <ChevronRight /> <Clock3 /> Watch at top-right</div>
        </div>

        <div className="loop-arrow" aria-hidden>percept <ArrowRight /> <ArrowLeft /> action </div>

        <div className={`lesson-panel ${phase === "memory" ? "panel-active" : "panel-muted"}`}>
          <div className="panel-heading lesson-one-memory-heading"><span><Brain /></span><div><strong>Nova’s memory</strong><small>Stores associations between percepts and actions.</small></div></div>
          <div className="interaction-bar">
            <span><strong>Your action</strong>{phase === "environment" ? "Open the memory to continue." : "Draw one possible action."}</span>
            {phase === "environment" ? (
              <button className="button-primary" onClick={() => setPhase("memory")}>Open memory <ArrowRight /></button>
            ) : (
              <button className="button-primary" onClick={sampleAction}><Sparkles /> Sample an action</button>
            )}
          </div>
          {phase === "environment" ? (
            <div className="memory-locked">
              <Brain />
              <p>Nova’s memories associate each percept to four possible actions with different strengths.</p>
            </div>
          ) : (
            <>
              <div className="memory-and-probability">
                <MemoryGrid memory={memory} view="policy" focus={agent} showValues={false} colorActions emphasizeStrength showAgent />
                <ProbabilityInset probabilities={startPolicy} />
              </div>
              <div className="sample-box">
                <SampleHistogram counts={sampleCounts} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="lesson-footer">
        <button className="button-text" onClick={onPrevious}><ArrowLeft /> Back</button>
        <button className="button-primary" disabled={sampled === null} onClick={() => setShowQuiz(true)}>Check my understanding <ArrowRight /></button>
      </div>
      {showQuiz && <QuizModal config={QUIZZES[0]} onBack={() => { setShowQuiz(false); onPrevious(); }} onContinue={onComplete} />}
    </section>
  );
}

type ComparisonMode = "slow" | "fast";

function GlowComparison({
  steps,
  selected,
  onSelect,
}: {
  steps: number;
  selected: ComparisonMode;
  onSelect: (mode: ComparisonMode) => void;
}) {
  const samples = Array.from({ length: Math.min(7, steps + 1) }, (_, index) => index);
  const age = Math.max(0, steps - 1);
  const slowCredit = Math.pow(0.9, age) * 1.4;
  const fastCredit = Math.pow(0.3, age) * 1.4;
  return (
    <div className="comparison-card">
      <div className="comparison-title"><Footprints /> Same path, different glow decay</div>
      <button className={`decay-row ${selected === "slow" ? "selected" : ""}`} onClick={() => onSelect("slow")} aria-pressed={selected === "slow"}>
        <span><strong>η = 0.10</strong><small>slow decay · first-step update +{slowCredit.toFixed(2)}</small></span>
        <span className="decay-dots">{samples.map((sampleAge) => <i style={{ opacity: Math.pow(0.9, samples.length - sampleAge - 1) }} key={sampleAge} />)}<em aria-hidden /></span>
      </button>
      <button className={`decay-row ${selected === "fast" ? "selected" : ""}`} onClick={() => onSelect("fast")} aria-pressed={selected === "fast"}>
        <span><strong>η = 0.70</strong><small>fast decay · first-step update +{fastCredit.toFixed(2)}</small></span>
        <span className="decay-dots fast">{samples.map((sampleAge) => <i style={{ opacity: Math.max(0.08, Math.pow(0.3, samples.length - sampleAge - 1)) }} key={sampleAge} />)}<em aria-hidden /></span>
      </button>
      <p>A smaller η keeps earlier actions glowing, so a distant reward can reach farther back.</p>
    </div>
  );
}

function GlowLevel({ onPrevious, onComplete }: { onPrevious: () => void; onComplete: () => void }) {
  const [agent, setAgent] = useState<Point>(START);
  const [trail, setTrail] = useState<Point[]>([START]);
  const [memories, setMemories] = useState<{ slow: Memory; fast: Memory }>(() => ({ slow: makeMemory(), fast: makeMemory() }));
  const [decayMode, setDecayMode] = useState<ComparisonMode>("slow");
  const [view, setView] = useState<MemoryView>("glow");
  const [steps, setSteps] = useState(0);
  const [reached, setReached] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);

  function takeStep() {
    if (reached) return;
    // Alternating up/right creates a short, guaranteed route while retaining stochastic policy elsewhere.
    const action: Action = agent.y > 0 && (agent.x === GRID_SIZE - 1 || steps % 2 === 0) ? "up" : "right";
    const actionIndex = ACTIONS.indexOf(action);
    const next = move(agent, action);
    const found = next.x === WATCH.x && next.y === WATCH.y;

    setMemories((current) => {
      const updateMemory = (memory: Memory, retention: number) => {
        const updated = copyMemory(memory);
        updated.forEach((row) => row.forEach((cell) => {
          cell.glow = cell.glow.map((value) => value * retention);
          cell.h = cell.h.map((value) => 1 + (value - 1) * 0.995);
        }));
        updated[agent.y][agent.x].glow[actionIndex] = 1;
        if (found) {
          updated.forEach((row) => row.forEach((cell) => {
            cell.h = cell.h.map((value, index) => value + cell.glow[index] * 1.4);
          }));
        }
        return updated;
      };
      return {
        slow: updateMemory(current.slow, 0.9),
        fast: updateMemory(current.fast, 0.3),
      };
    });
    setAgent(next);
    setTrail((current) => [...current, next]);
    setSteps((current) => current + 1);
    if (found) {
      setReached(true);
      setView("h");
    }
  }

  function reset() {
    setAgent(START);
    setTrail([START]);
    setMemories({ slow: makeMemory(), fast: makeMemory() });
    setDecayMode("slow");
    setSteps(0);
    setReached(false);
    setView("glow");
  }

  return (
    <section className="lesson-page">
      <div className="lesson-intro lesson-intro-row">
        <div><span className="story-eyebrow"><Footprints /> Lesson 2 · Follow the trace</span><h1>How does a move change the memory?</h1></div>
        <NovaFaceMedal />
      </div>
      <p className="lesson-summary">Move Nova one step at a time. Each choice leaves a temporary <strong>glow</strong>. It flags her recent moves and <strong>fades away</strong> as time passes. When the watch is recovered, the <strong>reward travels along that glowing trail</strong> and raises the strength of associations that were used during deliberation.</p>

      <div className="learning-layout">
        <div className="lesson-panel environment-panel">
          <div className="panel-heading panel-heading-with-counter"><span><Search /></span><div><strong>Training room</strong><small>Follow Nova in her environment.</small></div><div className="card-counter"><strong>{steps}</strong><small>steps</small></div></div>
          <div className="interaction-bar step-controls">
            <span><strong>Your action</strong>{reached ? "The watch is recovered." : "Advance Nova by one decision."}</span>
            <button className="button-primary" onClick={takeStep} disabled={reached}><Footprints /> Take one step</button>
            <button className="icon-button" onClick={reset} title="Reset this trip"><RotateCcw /></button>
          </div>
          <AdventureGrid agent={agent} trail={trail} active={!reached} />
          {reached && <div className="success-note"><Trophy /> <span><strong>Watch recovered!</strong> Now compare the three attributes of the memory.</span></div>}
        </div>

        <div className="lesson-panel memory-panel-wide">
          <div className="panel-heading"><span><Brain /></span><div><strong>Memory associations</strong><small>The memory has three functions. (1) Glow represents a short-term memory of recent actions. (2) H-values store long-term useful associations between percepts and actions. (3) The policy is derived from the H-values and determines how likely Nova is to take an action for each given percept.</small></div></div>
          {reached && (
            <div className="interaction-bar completion-bar">
              <span><strong>Next action</strong>Review the highlighted update, then continue to Lesson 3.</span>
              <button className="button-primary" onClick={() => setShowQuiz(true)}>Continue <ArrowRight /></button>
            </div>
          )}
          <MemoryTabs value={view} onChange={setView} />
          <div className={`memory-setting-label ${decayMode}`}>{decayMode === "slow" ? "Green glow · η = 0.10" : "Red glow · η = 0.70"}</div>
          <MemoryGrid memory={memories[decayMode]} view={view} focus={agent} highlightUpdates={reached} glowColor={decayMode === "slow" ? "green" : "red"} />
          <div className="view-explanation">
            {view === "glow" && <><strong>Glow</strong> shows which recent percept–action edges are eligible for credit.</>}
            {view === "h" && <><strong>H-values</strong> are durable connection strengths. {reached ? "Gold highlights mark the edges that just received reward." : "They will update when the watch is found."}</>}
            {view === "policy" && <><strong>Policy</strong> turns the four h-values into the probabilities used for the next choice.</>}
          </div>
        </div>
      </div>
      <GlowComparison steps={steps} selected={decayMode} onSelect={setDecayMode} />
      <div className="lesson-footer">
        <button className="button-text" onClick={onPrevious}><ArrowLeft /> Previous lesson</button>
        <button className="button-primary" disabled={!reached} onClick={() => setShowQuiz(true)}>Finish lesson <ArrowRight /></button>
      </div>
      {showQuiz && <QuizModal config={QUIZZES[1]} onBack={() => { setShowQuiz(false); onPrevious(); }} onContinue={onComplete} />}
    </section>
  );
}

type PracticeRun = {
  agent: Point;
  trail: Point[];
  step: number;
  recovered: number;
  memory: Memory;
  lastAction: Action | null;
  instantReward: number;
  cumulativeReward: number;
  rewardPauseTicks: number;
};

type PracticeState = Record<ComparisonMode, PracticeRun>;

function makePracticeRun(): PracticeRun {
  return {
    agent: START,
    trail: [START],
    step: 0,
    recovered: 0,
    memory: makeMemory(),
    lastAction: null,
    instantReward: 0,
    cumulativeReward: 0,
    rewardPauseTicks: 0,
  };
}

function restartPracticeSession(current: PracticeRun): PracticeRun {
  return {
    ...current,
    agent: START,
    trail: [START],
    step: 0,
    recovered: 0,
    lastAction: null,
    instantReward: 0,
    rewardPauseTicks: 0,
  };
}

function sampleMemoryAction(memory: Memory, point: Point): Action {
  const probabilities = policy(memory[point.y][point.x].h);
  const draw = Math.random();
  let cumulative = 0;
  for (let index = 0; index < probabilities.length; index += 1) {
    cumulative += probabilities[index];
    if (draw <= cumulative) return ACTIONS[index];
  }
  return ACTIONS[ACTIONS.length - 1];
}

function advancePracticeRun(current: PracticeRun, forgetting: ComparisonMode, targetRecoveries: number): PracticeRun {
  if (current.rewardPauseTicks > 0) {
    const rewardPauseTicks = current.rewardPauseTicks - 1;
    return rewardPauseTicks === 0
      ? { ...current, agent: START, trail: [START], instantReward: 0, lastAction: null, rewardPauseTicks }
      : { ...current, rewardPauseTicks };
  }
  if (current.recovered >= targetRecoveries) return current;

  const action = sampleMemoryAction(current.memory, current.agent);
  const actionIndex = ACTIONS.indexOf(action);
  const next = move(current.agent, action);
  const found = next.x === WATCH.x && next.y === WATCH.y;
  const instantReward = found ? FINAL_REWARD : -0.02;
  const gamma = forgetting === "slow" ? 0.0001 : 0.1;
  const updatedMemory = copyMemory(current.memory);

  updatedMemory.forEach((row) => row.forEach((cell) => {
    cell.glow = cell.glow.map((value) => value * PRACTICE_GLOW_RETENTION);
    cell.h = cell.h.map((value) => 1 + (value - 1) * (1 - gamma));
  }));
  updatedMemory[current.agent.y][current.agent.x].glow[actionIndex] = 1;
  if (found) {
    updatedMemory.forEach((row) => row.forEach((cell) => {
      cell.h = cell.h.map((value, index) => value + cell.glow[index] * instantReward);
    }));
  }

  return {
    agent: next,
    trail: [...current.trail, next],
    step: found ? 0 : current.step + 1,
    recovered: current.recovered + (found ? 1 : 0),
    memory: updatedMemory,
    lastAction: action,
    instantReward,
    cumulativeReward: current.cumulativeReward + instantReward,
    // At 150 ms per tick, six held ticks leave the successful state visible for 0.9 s.
    rewardPauseTicks: found ? 6 : 0,
  };
}

function PracticeLevel({ onPrevious, onComplete }: { onPrevious: () => void; onComplete: () => void }) {
  const targetRecoveries = 5;
  const [running, setRunning] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [view, setView] = useState<MemoryView>("glow");
  const [forgettingMode, setForgettingMode] = useState<ComparisonMode>("slow");
  const [practice, setPractice] = useState<PracticeState>(() => ({ slow: makePracticeRun(), fast: makePracticeRun() }));
  const [completedModels, setCompletedModels] = useState<Record<ComparisonMode, boolean>>({ slow: false, fast: false });

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setPractice((current) => ({
        ...current,
        [forgettingMode]: advancePracticeRun(current[forgettingMode], forgettingMode, targetRecoveries),
      }));
    }, 150);
    return () => window.clearInterval(timer);
  }, [forgettingMode, running]);

  useEffect(() => {
    const activeFinished = practice[forgettingMode].recovered >= targetRecoveries
      && practice[forgettingMode].rewardPauseTicks === 0;
    if (running && activeFinished) {
      setRunning(false);
      setCompletedModels((current) => ({ ...current, [forgettingMode]: true }));
    }
  }, [forgettingMode, practice, running]);

  function selectForgettingMode(mode: ComparisonMode) {
    if (mode === forgettingMode) return;
    setRunning(false);
    setForgettingMode(mode);
    setPractice((current) => ({ ...current, [mode]: restartPracticeSession(current[mode]) }));
    setCompletedModels((current) => ({ ...current, [mode]: false }));
  }

  function reset() {
    setRunning(false);
    setShowQuiz(false);
    setView("glow");
    setForgettingMode("slow");
    setPractice({ slow: makePracticeRun(), fast: makePracticeRun() });
    setCompletedModels({ slow: false, fast: false });
  }

  const activePractice = practice[forgettingMode];
  const rewardRange = targetRecoveries * FINAL_REWARD;
  const rewardPosition = (reward: number) => Math.max(0, Math.min(100, 50 + reward / (rewardRange * 2) * 100));
  const slowPosition = rewardPosition(practice.slow.cumulativeReward);
  const fastPosition = rewardPosition(practice.fast.cumulativeReward);
  const finished = completedModels.slow && completedModels.fast;
  const activeFinished = activePractice.recovered >= targetRecoveries;
  const hasPracticeStarted = (["slow", "fast"] as ComparisonMode[]).some((mode) =>
    practice[mode].lastAction !== null || practice[mode].cumulativeReward !== 0,
  );

  function stopAndCheckUnderstanding() {
    setRunning(false);
    setShowQuiz(true);
  }

  return (
    <section className="lesson-page">
      <div className="lesson-intro lesson-intro-row">
        <div><span className="story-eyebrow"><Trophy /> Lesson 3 · Consolidate with repetitions</span><h1>Practice makes perfect!</h1></div>
        <NovaFaceMedal />
      </div>
      <p className="lesson-summary">Run multiple trajectories and see how forgetting affects Nova’s memory. Select either setting below to inspect its matching decisions, position, and three memory attributes.</p>

      <div className="practice-layout">
        <div className="lesson-panel practice-environment">
          <div className="panel-heading panel-heading-with-counter"><span><Search /></span><div><strong>Training room </strong><small>Observe trajectories Nova can take.</small></div><div className="card-counter"><strong>{activePractice.recovered}/{targetRecoveries}</strong><small>trajectories</small></div></div>
          <div className={`memory-setting-label ${forgettingMode}`}>{forgettingMode === "slow" ? "Slow forgetting · γ = 0.0001 · η = 0.05" : "Fast forgetting · γ = 0.1 · η = 0.05"}</div>
          <div className="reward-readout">
            <span>Instant reward</span>
            <strong className={activePractice.instantReward > 0 ? "positive" : ""}>
              {activePractice.lastAction ? `${ARROWS[ACTIONS.indexOf(activePractice.lastAction)]} ${activePractice.lastAction}` : "No action yet"}
              <b>{activePractice.instantReward >= 0 ? "+" : ""}{activePractice.instantReward.toFixed(2)}</b>
            </strong>
          </div>
          <div className="interaction-bar practice-controls">
            <span><strong>Your action</strong>{running ? "Watch the next decisions." : "Start or pause the training."}</span>
            <div>
              <button className="button-primary" onClick={() => setRunning((value) => !value)} disabled={activeFinished}>
                {running ? <><Pause /> Pause</> : <><Play /> {activePractice.recovered ? "Continue" : "Start"}</>}
              </button>
              <button className="icon-button" onClick={reset} title="Restart practice"><RotateCcw /></button>
            </div>
          </div>
          <AdventureGrid agent={activePractice.agent} trail={activePractice.trail} active={running && activePractice.rewardPauseTicks === 0} />
        </div>

        <div className="lesson-panel practice-memory">
          <div className="panel-heading"><span><Brain /></span><div><strong>Memory</strong><small>Watch glow become learning</small></div></div>
          <MemoryTabs value={view} onChange={setView} />
          <MemoryGrid memory={activePractice.memory} view={view} focus={activePractice.agent} glowColor={forgettingMode === "slow" ? "green" : "red"} emphasizeStrength />
          <div className="view-explanation">
            {view === "glow" && <><strong>Glow:</strong> recent edges are brighter.</>}
            {view === "h" && <><strong>H-values:</strong> reward consolidates useful edges.</>}
            {view === "policy" && <><strong>Policy:</strong> updated strengths become action chances.</>}
          </div>
        </div>

        <div className="forgetting-panel practice-progress">
          <div className="comparison-title"><Trophy /> Learning progress</div>
          <p>Select a cursor to show the corresponding environment and all three memory views. Values report cumulative reward, including step costs.</p>
          <button className={`memory-meter slow-meter ${forgettingMode === "slow" ? "selected" : ""}`} onClick={() => selectForgettingMode("slow")} aria-pressed={forgettingMode === "slow"}>
            <div><span><strong>Slow forgetting</strong><small>γ = 0.0001 {completedModels.slow ? "· complete" : ""}</small></span><b>Σ reward {practice.slow.cumulativeReward.toFixed(2)}</b></div>
            <div className="meter-track reward-track"><i style={{ left: `${Math.min(50, slowPosition)}%`, width: `${Math.abs(slowPosition - 50)}%` }}><em className={slowPosition < 50 ? "negative" : ""} /></i></div>
            <small>Consolidated routes become shorter over time.</small>
          </button>
          <button className={`memory-meter fast-meter ${forgettingMode === "fast" ? "selected" : ""}`} onClick={() => selectForgettingMode("fast")} aria-pressed={forgettingMode === "fast"}>
            <div><span><strong>Fast forgetting</strong><small>γ = 0.1 {completedModels.fast ? "· complete" : ""}</small></span><b>Σ reward {practice.fast.cumulativeReward.toFixed(2)}</b></div>
            <div className="meter-track reward-track"><i style={{ left: `${Math.min(50, fastPosition)}%`, width: `${Math.abs(fastPosition - 50)}%` }}><em className={fastPosition < 50 ? "negative" : ""} /></i></div>
            <small>More reward is lost to longer trajectories.</small>
          </button>
          <div className="model-trajectory-counters">
            <div className="trajectory-counter-row slow-trajectory-row">
              <span>Slow</span>
              <div className="episode-dots" aria-label={`${practice.slow.recovered} of ${targetRecoveries} slow-forgetting trajectories complete`}>
                {Array.from({ length: targetRecoveries }, (_, index) => <i className={index < practice.slow.recovered ? "complete" : ""} key={index}>{index + 1}</i>)}
              </div>
            </div>
            <div className="trajectory-counter-row fast-trajectory-row">
              <span>Fast</span>
              <div className="episode-dots" aria-label={`${practice.fast.recovered} of ${targetRecoveries} fast-forgetting trajectories complete`}>
                {Array.from({ length: targetRecoveries }, (_, index) => <i className={index < practice.fast.recovered ? "complete" : ""} key={index}>{index + 1}</i>)}
              </div>
            </div>
          </div>
          <div className="academy-tip"><Lightbulb /><span><strong>Coach’s observation</strong> Repetition refreshes useful connections; faster forgetting makes progress harder to retain.</span></div>
        </div>
      </div>

      <div className="lesson-footer">
        <button className="button-text" onClick={onPrevious}><ArrowLeft /> Previous lesson</button>
        {!finished ? (
          hasPracticeStarted ? (
            <button className="button-secondary" onClick={stopAndCheckUnderstanding}>
              <Pause /> Stop trajectories &amp; check my understanding
            </button>
          ) : (
            <span className="finish-hint">Start a trajectory to unlock the optional understanding check.</span>
          )
        ) : (
          <button className="button-primary" onClick={() => setShowQuiz(true)}>
            Answer final question <ArrowRight />
          </button>
        )}
      </div>
      {showQuiz && <QuizModal config={QUIZZES[2]} onBack={() => { setShowQuiz(false); onPrevious(); }} onContinue={onComplete} final />}
    </section>
  );
}

export default function AdventureMode({ onHome, onOpenLab }: { onHome: () => void; onOpenLab: () => void }) {
  const [level, setLevel] = useState(0);

  function goTo(next: number) {
    setLevel(Math.max(0, Math.min(3, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="adventure-shell">
      <header className="adventure-header">
        <button className="academy-brand" onClick={onHome} aria-label="Return to mode selection">
          <span><Search /></span><div><strong>Detective Academy</strong><small>Projective Simulation</small></div>
        </button>
        <nav className="adventure-progress" aria-label="Adventure progress">
          {LEVEL_TITLES.map((title, index) => (
            <button className={`${index === level ? "current" : ""} ${index < level ? "complete" : ""}`} onClick={() => index <= level && goTo(index)} key={title} title={title}>
              {index < level && <Check />}
              <span>{index === 0 ? "Briefing" : `Lesson ${index}`}</span>
            </button>
          ))}
        </nav>
        <button className="header-home" onClick={onHome}><Home /> <span>Modes</span></button>
      </header>

      <div className="adventure-content">
        {level === 0 && <WelcomeLevel onNext={() => goTo(1)} onSkip={() => goTo(1)} />}
        {level === 1 && <LoopLevel onPrevious={() => goTo(0)} onComplete={() => goTo(2)} />}
        {level === 2 && <GlowLevel onPrevious={() => goTo(1)} onComplete={() => goTo(3)} />}
        {level === 3 && <PracticeLevel onPrevious={() => goTo(2)} onComplete={onOpenLab} />}
      </div>
    </main>
  );
}
