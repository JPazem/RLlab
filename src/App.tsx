import { useEffect, useState } from "react";
import { Beaker, BookOpen, Compass, Sparkles } from "lucide-react";
import "./App.css";
import AdventureMode from "./AdventureMode";
import InteractiveRLLab from "./InteractiveRLLAb";
import LanguageToggle, { type AppLanguage } from "./LanguageToggle";
import WelcomeShare from "./WelcomeShare";
import CoachStanding from "./assets/Coach_Standing.png";
import NovaStanding from "./assets/Nova_Standing_noBackground.png";

type AppMode = "choose" | "adventure" | "lab";

const MODE_TEXT = {
  en: {
    kicker: "Projective Simulation Academy",
    title: "How would you like to explore?",
    intro: "Follow a playful detective story one idea at a time, or open the full reinforcement-learning laboratory and experiment freely.",
    guided: "Guided & playful",
    adventure: "Adventure mode",
    adventureDescription: "Coach a detective student, solve a case, and discover how an agent learns.",
    begin: "Begin the case",
    openEnded: "Open-ended",
    lab: "Lab mode",
    labDescription: "Design Nova’s training rooms, tune her memory, and investigate how she learns at the Detective Academy.",
    openLab: "Open the lab",
    note: "No prior knowledge is needed for Adventure mode.",
    modes: "Modes",
    coachAlt: "Academy coach",
    novaAlt: "Detective student Nova",
  },
  de: {
    kicker: "Akademie für projektive Simulation",
    title: "Wie möchtest du die Welt des Lernens erkunden?",
    intro: "Folge Schritt für Schritt einer spielerischen Detektivgeschichte oder öffne das vollständige Reinforcement-Learning-Labor und experimentiere frei.",
    guided: "Geführt & spielerisch",
    adventure: "Abenteuermodus",
    adventureDescription: "Trainiere eine Detektivschülerin, löse einen Fall und entdecke, wie ein Agent lernt.",
    begin: "Fall beginnen",
    openEnded: "Freies Experimentieren",
    lab: "Labormodus",
    labDescription: "Gestalte Novas Trainingsräume, passe ihr Gedächtnis an und untersuche ihr Lernen an der Detektivakademie.",
    openLab: "Labor öffnen",
    note: "Für den Abenteuermodus brauchst du keine Vorkenntnisse.",
    modes: "Modi",
    coachAlt: "Coach der Akademie",
    novaAlt: "Detektivschülerin Nova",
  },
};

function ModeChooser({
  onChoose,
  language,
  onLanguageChange,
}: {
  onChoose: (mode: Exclude<AppMode, "choose">) => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
}) {
  const text = MODE_TEXT[language];
  return (
    <main className="mode-page">
      <LanguageToggle language={language} onChange={onLanguageChange} className="mode-language-toggle" />
      <div className="mode-glow mode-glow-one" />
      <div className="mode-glow mode-glow-two" />
      <section className="mode-hero">
        <div className="mode-kicker"><Sparkles size={17} /> {text.kicker}</div>
        <h1>{text.title}</h1>
        <p>{text.intro}</p>
        <div className="mode-choice-stage">
          <img className="mode-standing-character mode-coach-standing" src={CoachStanding} alt={text.coachAlt} />
          <div className="mode-options">
            <button className="mode-card mode-card-adventure" onClick={() => onChoose("adventure")}>
              <span className="mode-icon"><Compass /></span>
              <span className="mode-label">{text.guided}</span>
              <strong>{text.adventure}</strong>
              <span>{text.adventureDescription}</span>
              <span className="mode-cta">{text.begin} <span aria-hidden>→</span></span>
            </button>
            <button className="mode-card mode-card-lab" onClick={() => onChoose("lab")}>
              <span className="mode-icon"><Beaker /></span>
              <span className="mode-label">{text.openEnded}</span>
              <strong>{text.lab}</strong>
              <span>{text.labDescription}</span>
              <span className="mode-cta">{text.openLab} <span aria-hidden>→</span></span>
            </button>
          </div>
          <img className="mode-standing-character mode-nova-standing" src={NovaStanding} alt={text.novaAlt} />
        </div>
        <p className="mode-note"><BookOpen size={16} /> {text.note}</p>
        <WelcomeShare language={language} />
      </section>
    </main>
  );
}

export default function App() {
  const [mode, setMode] = useState<AppMode>("choose");
  const [language, setLanguage] = useState<AppLanguage>(() => {
    try {
      return window.localStorage.getItem("rllab-language") === "de" ? "de" : "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem("rllab-language", language);
    } catch {
      // The in-memory selection still works if browser storage is unavailable.
    }
  }, [language]);

  if (mode === "choose") return <ModeChooser onChoose={setMode} language={language} onLanguageChange={setLanguage} />;
  if (mode === "adventure") {
    return <AdventureMode onHome={() => setMode("choose")} language={language} onLanguageChange={setLanguage} />;
  }

  return (
    <div className="lab-shell">
      <InteractiveRLLab language={language} onLanguageChange={setLanguage} onHome={() => setMode("choose")} />
    </div>
  );
}
