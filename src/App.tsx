import { useState } from "react";
import { ArrowLeft, Beaker, BookOpen, Compass, Sparkles } from "lucide-react";
import "./App.css";
import AdventureMode from "./AdventureMode";
import InteractiveRLLab from "./InteractiveRLLAb";

type AppMode = "choose" | "adventure" | "lab";

function ModeChooser({ onChoose }: { onChoose: (mode: Exclude<AppMode, "choose">) => void }) {
  return (
    <main className="mode-page">
      <div className="mode-glow mode-glow-one" />
      <div className="mode-glow mode-glow-two" />
      <section className="mode-hero">
        <div className="mode-kicker"><Sparkles size={17} /> Projective Simulation Academy</div>
        <h1>How would you like to explore?</h1>
        <p>
          Follow a playful detective story one idea at a time, or open the full
          reinforcement-learning laboratory and experiment freely.
        </p>
        <div className="mode-options">
          <button className="mode-card mode-card-adventure" onClick={() => onChoose("adventure")}>
            <span className="mode-icon"><Compass /></span>
            <span className="mode-label">Guided & playful</span>
            <strong>Adventure mode</strong>
            <span>Coach a detective student, solve a case, and discover how an agent learns.</span>
            <span className="mode-cta">Begin the case <span aria-hidden>→</span></span>
          </button>
          <button className="mode-card mode-card-lab" onClick={() => onChoose("lab")}>
            <span className="mode-icon"><Beaker /></span>
            <span className="mode-label">Open-ended</span>
            <strong>Lab mode</strong>
            <span>Build environments, tune every parameter, and inspect learning curves.</span>
            <span className="mode-cta">Open the lab <span aria-hidden>→</span></span>
          </button>
        </div>
        <p className="mode-note"><BookOpen size={16} /> No prior knowledge is needed for Adventure mode.</p>
      </section>
    </main>
  );
}

export default function App() {
  const [mode, setMode] = useState<AppMode>("choose");

  if (mode === "choose") return <ModeChooser onChoose={setMode} />;
  if (mode === "adventure") {
    return <AdventureMode onHome={() => setMode("choose")} onOpenLab={() => setMode("lab")} />;
  }

  return (
    <div className="lab-shell">
      <button className="back-to-modes" onClick={() => setMode("choose")}>
        <ArrowLeft size={17} /> Modes
      </button>
      <InteractiveRLLab />
    </div>
  );
}
