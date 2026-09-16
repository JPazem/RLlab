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
import LanguageToggle, { type AppLanguage } from "./LanguageToggle";

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
const ADVENTURE_TEXT = {
  en: {
    levelTitles: ["Welcome, Coach", "The Percept–Action Loop", "How One Trip Teaches", "Practice Makes Memory"],
    actions: ["up", "right", "down", "left"],
    characterStanding: "Nova standing",
    detectiveStudent: "Detective student",
    detectiveStudentNova: "Detective student Nova",
    newStudent: "Your new detective student",
    detectiveTraining: "Detective in training",
    novaPortrait: "Nova portrait",
    novaPosition: "Nova’s current position",
    gridLabel: "Five by five detective training grid",
    colorPercept: "Color percept at row {row}, column {column}",
    lostWatch: "The lost watch",
    object: "Object",
    memoryShown: "Agent memory shown as {view}",
    probabilityExplorer: "Probability explorer",
    probabilitySubtitle: "Two ways to see the same chances",
    probabilityVisualization: "Probability visualization",
    bars: "Bars",
    beads: "Beads",
    beadJar: "A jar of colored action beads",
    beadExplanation: "If Nova draws one bead without looking, colors that appear more often are more likely to be selected.",
    sampleHistogram: "Histogram of {count} sampled actions",
    sampledActions: "Nova’s sampled actions",
    lastAction: "Last action",
    sample: "sample",
    samples: "samples",
    memoryRepresentation: "Memory representation",
    glow: "Glow",
    hValues: "H-values",
    policy: "Policy",
    exactly: "Exactly!",
    notQuite: "Not quite yet.",
    previousLesson: "Previous lesson",
    nextLesson: "Next lesson",
    openLabMode: "Open Lab mode",
    quizzes: [
      {
        eyebrow: "Case note 1 of 3",
        question: "How does Nova choose an action from memory?",
        answers: ["The strongest arrow always wins", "The stronger the arrow, the more chances to choose (sample) the corresponding action.", "The watch tells Nova where to move"],
        correct: 1,
        explanation: "Nova turns the four weights into chances. A stronger arrow is more likely, but it is not guaranteed to be chosen.",
      },
      {
        eyebrow: "Case note 2 of 3",
        question: "What job does glow do during a trajectory?",
        answers: ["It marks recent choices so a later reward can strengthen them", "It changes the color of the environment", "It guarantees the shortest path immediately"],
        correct: 0,
        explanation: "Glow is a temporary trail in memory that fades away with time. When the watch is found, edges that glow more receive more credit.",
      },
      {
        eyebrow: "Final academy check",
        question: "What happens when forgetting is very fast?",
        answers: ["Old improvements fade quickly unless useful trips are repeated", "Every action keeps its strongest value forever", "Nova stops using probabilities"],
        correct: 0,
        explanation: "Repetition consolidates a useful route, while forgetting continuously pulls unused connections back toward their starting value.",
      },
    ],
    newCase: "A new case has arrived",
    welcomeTitle: "Welcome to the Detective Academy, Coach!",
    welcomeLead: "You are in charge of a new student of the Detective Academy, Nova. Guide her in the acquisition of her first detective skill: recovering lost objects.",
    yourTask: "Your task:",
    taskDescription: "Train Nova and give her her first detective lesson!",
    welcomeStory: "Today’s mystery is a lost watch hidden in a place Nova has never seen. You won’t tell Nova where to find it. Instead, you’ll help her discover it through trial and error, and reward her every time she finds the watch.",
    meetNova: "Meet Nova",
    skipStory: "Skip the story",
    lesson1Eyebrow: "Lesson 1 · See and Act",
    lesson1Title: "The percept–action loop",
    lesson1Summary: "This is a mess! Help Nova find the watch in this chaos. Nova can see the color and contents of each cell, and decide where to move next. Everything Nova sees is called a percept. Based on the current percept, Nova chooses an action. After she moves, she has access to the next percept: its color and object.",
    trainingRoom: "Training room",
    environmentDescription: "The environment: what Nova can see and affect.",
    lookFirst: "Look first:",
    lookInstruction: "find Nova, the watch, and the colored percepts.",
    studentBottomLeft: "Student at bottom-left",
    watchTopRight: "Watch at top-right",
    percept: "percept",
    action: "action",
    novaMemory: "Nova’s memory",
    associationDescription: "Stores associations between percepts and actions.",
    yourAction: "Your action",
    openMemoryPrompt: "Open the memory to continue.",
    drawActionPrompt: "Explore how the initial move is chosen.",
    openMemory: "Open memory",
    sampleAction: "Sample an action",
    memoryLocked: "Nova’s memories associate each percept with four possible actions of different strengths.",
    back: "Back",
    checkUnderstanding: "Check my understanding",
    comparisonTitle: "Same path, different glow decay",
    slowDecay: "slow decay",
    fastDecay: "fast decay",
    firstStepUpdate: "first-step update",
    decayExplanation: "A smaller η keeps earlier actions glowing, so a distant reward can reach farther back.",
    lesson2Eyebrow: "Lesson 2 · Follow the trace",
    lesson2Title: "How does a move change the memory?",
    lesson2Summary: "Move Nova one step at a time. Each choice leaves a temporary glow. It marks her recent moves and fades as time passes. When the watch is recovered, the reward travels along that glowing trail and increases the strength of the associations used during deliberation.",
    followNova: "Follow Nova in her environment.",
    steps: "steps",
    watchRecovered: "The watch is recovered.",
    advanceDecision: "Advance Nova by one decision.",
    takeStep: "Take one step",
    resetTrip: "Reset this trip",
    watchRecoveredTitle: "Watch recovered!",
    compareMemory: "Now compare the three attributes of the memory.",
    memoryAssociations: "Memory associations",
    memoryFunctions: "The memory has three functions. (1) Glow represents a short-term memory of recent actions. (2) H-values store long-term useful associations between percepts and actions. (3) The policy is derived from the H-values and determines how likely Nova is to take an action for each percept.",
    nextAction: "Next action",
    reviewUpdate: "Review the highlighted update, then continue to Lesson 3.",
    continue: "Continue",
    greenGlow: "Green glow",
    redGlow: "Red glow",
    glowExplanation: "shows which recent percept–action edges are eligible for credit.",
    hExplanation: "are durable connection strengths.",
    goldUpdate: "Gold highlights mark the edges that just received reward.",
    updateWhenFound: "They will update when the watch is found.",
    policyExplanation: "turns the four h-values into the probabilities used for the next choice.",
    finishLesson: "Finish lesson",
    lesson3Eyebrow: "Lesson 3 · Consolidate with repetitions",
    lesson3Title: "Practice makes perfect!",
    lesson3Summary: "Run multiple trajectories and see how forgetting affects Nova’s memory. Select either setting below to inspect its matching decisions, position, and three memory attributes.",
    observeTrajectories: "Observe trajectories Nova can take.",
    trajectories: "trajectories",
    slowForgetting: "Slow forgetting",
    fastForgetting: "Fast forgetting",
    instantReward: "Instant reward",
    noAction: "No action yet",
    watchDecisions: "Watch the next decisions.",
    startPauseTraining: "Start or pause the training.",
    pause: "Pause",
    start: "Start",
    restartPractice: "Restart practice",
    memory: "Memory",
    glowLearning: "Watch glow become learning",
    recentEdges: "recent edges are brighter.",
    rewardConsolidates: "reward consolidates useful edges.",
    strengthsChances: "updated strengths become action chances.",
    learningProgress: "Learning progress",
    progressExplanation: "Select a cursor to show the corresponding environment and all three memory views. Values report cumulative reward, including step costs.",
    complete: "complete",
    reward: "reward",
    slowRouteNote: "Consolidated routes become shorter over time.",
    fastRouteNote: "More reward is lost to longer trajectories.",
    slow: "Slow",
    fast: "Fast",
    trajectoryProgress: "{done} of {total} {mode}-forgetting trajectories complete",
    coachObservation: "Coach’s observation",
    observationText: "Repetition refreshes useful connections; faster forgetting makes progress harder to retain.",
    stopAndCheck: "Stop trajectories & check my understanding",
    startHint: "Start a trajectory to unlock the optional understanding check.",
    finalQuestion: "Answer final question",
    briefing: "Briefing",
    lesson: "Lesson",
    modes: "Modes",
    academyBrand: "Detective Academy",
    academySubtitle: "Projective Simulation",
    returnModes: "Return to mode selection",
    adventureProgress: "Adventure progress",
  },
  de: {
    levelTitles: ["Willkommen, Coach", "Die Wahrnehmungs-Aktions-Schleife", "Wie ein Durchlauf lehrt", "Übung stärkt das Gedächtnis"],
    actions: ["oben", "rechts", "unten", "links"],
    characterStanding: "Nova stehend",
    detectiveStudent: "Detektivschülerin",
    detectiveStudentNova: "Detektivschülerin Nova",
    newStudent: "Deine neue Detektivschülerin",
    detectiveTraining: "Detektivin in Ausbildung",
    novaPortrait: "Porträt von Nova",
    novaPosition: "Novas aktuelle Position",
    gridLabel: "Detektiv-Trainingsfeld mit fünf mal fünf Zellen",
    colorPercept: "Farbwahrnehmung in Zeile {row}, Spalte {column}",
    lostWatch: "Die verlorene Uhr",
    object: "Gegenstand",
    memoryShown: "Gedächtnis des Agenten als {view}",
    probabilityExplorer: "Wahrscheinlichkeits-Explorer",
    probabilitySubtitle: "Zwei Darstellungen derselben Chancen",
    probabilityVisualization: "Darstellung der Wahrscheinlichkeiten",
    bars: "Balken",
    beads: "Kugeln",
    beadJar: "Ein Glas mit farbigen Aktionskugeln",
    beadExplanation: "Wenn Nova blind eine Kugel zieht, werden häufiger vorkommende Farben mit höherer Wahrscheinlichkeit ausgewählt.",
    sampleHistogram: "Histogramm von {count} gezogenen Aktionen",
    sampledActions: "Novas gezogene Aktionen",
    lastAction: "Letzte Aktion",
    sample: "Ziehung",
    samples: "Ziehungen",
    memoryRepresentation: "Darstellung des Gedächtnisses",
    glow: "Glow",
    hValues: "H-Werte",
    policy: "Policy",
    exactly: "Genau!",
    notQuite: "Noch nicht ganz.",
    previousLesson: "Vorherige Lektion",
    nextLesson: "Nächste Lektion",
    openLabMode: "Labormodus öffnen",
    quizzes: [
      {
        eyebrow: "Fallnotiz 1 von 3",
        question: "Wie wählt Nova eine Aktion aus ihrem Gedächtnis?",
        answers: ["Der stärkste Pfeil gewinnt immer", "Je stärker ein Pfeil ist, desto größer ist die Chance, die zugehörige Aktion auszuwählen.", "Die Uhr sagt Nova, wohin sie gehen soll"],
        correct: 1,
        explanation: "Nova wandelt die vier Gewichte in Wahrscheinlichkeiten um. Ein stärkerer Pfeil wird eher gewählt, aber seine Auswahl ist nicht garantiert.",
      },
      {
        eyebrow: "Fallnotiz 2 von 3",
        question: "Welche Aufgabe hat der Glow während einer Trajektorie?",
        answers: ["Er markiert kürzlich gewählte Aktionen, damit eine spätere Belohnung sie verstärken kann", "Er verändert die Farbe der Umgebung", "Er garantiert sofort den kürzesten Weg"],
        correct: 0,
        explanation: "Der Glow ist eine vorübergehende Spur im Gedächtnis, die mit der Zeit verblasst. Wenn die Uhr gefunden wird, erhalten stärker leuchtende Verbindungen mehr Anerkennung.",
      },
      {
        eyebrow: "Abschlussprüfung der Akademie",
        question: "Was geschieht bei sehr schnellem Vergessen?",
        answers: ["Ältere Verbesserungen verblassen schnell, wenn nützliche Wege nicht wiederholt werden", "Jede Aktion behält ihren stärksten Wert für immer", "Nova verwendet keine Wahrscheinlichkeiten mehr"],
        correct: 0,
        explanation: "Wiederholung festigt einen nützlichen Weg, während das Vergessen ungenutzte Verbindungen fortlaufend zu ihrem Ausgangswert zurückzieht.",
      },
    ],
    newCase: "Ein neuer Fall ist eingetroffen",
    welcomeTitle: "Willkommen in der Detektivakademie, Coach!",
    welcomeLead: "Du bist für Nova, eine neue Schülerin der Detektivakademie, verantwortlich. Hilf ihr, ihre erste Detektivfähigkeit zu erlernen: verlorene Gegenstände wiederzufinden.",
    yourTask: "Deine Aufgabe:",
    taskDescription: "Trainiere Nova und erteile ihr die erste Detektivlektion!",
    welcomeStory: "Im heutigen Fall geht es um eine verlorene Uhr, die an einem für Nova unbekannten Ort versteckt ist. Du verrätst ihr nicht, wo sie liegt. Stattdessen hilfst du ihr, die Uhr durch Versuch und Irrtum zu entdecken, und belohnst sie jedes Mal, wenn sie sie findet.",
    meetNova: "Nova kennenlernen",
    skipStory: "Geschichte überspringen",
    lesson1Eyebrow: "Lektion 1 · Sehen und handeln",
    lesson1Title: "Die Wahrnehmungs-Aktions-Schleife",
    lesson1Summary: "Was für ein Durcheinander! Hilf Nova, in diesem Chaos die Uhr zu finden. Nova sieht die Farbe und den Inhalt jeder Zelle und entscheidet, wohin sie als Nächstes geht. Alles, was Nova sieht, nennt man Wahrnehmung oder Perzept. Ausgehend vom aktuellen Perzept wählt Nova eine Aktion. Nach der Bewegung nimmt sie die nächste Farbe und den nächsten Gegenstand wahr.",
    trainingRoom: "Trainingsraum",
    environmentDescription: "Die Umgebung: was Nova sehen und beeinflussen kann.",
    lookFirst: "Schau zuerst:",
    lookInstruction: "Finde Nova, die Uhr und die farbigen Perzepte.",
    studentBottomLeft: "Schülerin unten links",
    watchTopRight: "Uhr oben rechts",
    percept: "Perzept",
    action: "Aktion",
    novaMemory: "Novas Gedächtnis",
    associationDescription: "Speichert Verknüpfungen zwischen Perzepten und Aktionen.",
    yourAction: "Deine Aktion",
    openMemoryPrompt: "Öffne das Gedächtnis, um fortzufahren.",
    drawActionPrompt: "Ziehe eine mögliche Aktion.",
    openMemory: "Gedächtnis öffnen",
    sampleAction: "Aktion ziehen",
    memoryLocked: "Novas Gedächtnis verknüpft jedes Perzept mit vier möglichen Aktionen unterschiedlicher Stärke.",
    back: "Zurück",
    checkUnderstanding: "Mein Verständnis prüfen",
    comparisonTitle: "Gleicher Weg, unterschiedlicher Glow-Abbau",
    slowDecay: "langsamer Abbau",
    fastDecay: "schneller Abbau",
    firstStepUpdate: "Aktualisierung des ersten Schritts",
    decayExplanation: "Ein kleineres η hält frühere Aktionen länger im Glow, sodass eine entfernte Belohnung weiter zurückwirken kann.",
    lesson2Eyebrow: "Lektion 2 · Der Spur folgen",
    lesson2Title: "Wie verändert ein Schritt das Gedächtnis?",
    lesson2Summary: "Bewege Nova Schritt für Schritt. Jede Wahl hinterlässt einen vorübergehenden Glow. Er markiert ihre letzten Bewegungen und verblasst mit der Zeit. Wenn die Uhr gefunden wird, wandert die Belohnung entlang dieser leuchtenden Spur und erhöht die Stärke der verwendeten Verknüpfungen.",
    followNova: "Folge Nova in ihrer Umgebung.",
    steps: "Schritte",
    watchRecovered: "Die Uhr wurde gefunden.",
    advanceDecision: "Lass Nova eine weitere Entscheidung treffen.",
    takeStep: "Einen Schritt gehen",
    resetTrip: "Diesen Weg zurücksetzen",
    watchRecoveredTitle: "Uhr gefunden!",
    compareMemory: "Vergleiche jetzt die drei Eigenschaften des Gedächtnisses.",
    memoryAssociations: "Gedächtnisverknüpfungen",
    memoryFunctions: "Das Gedächtnis hat drei Funktionen. (1) Der Glow ist ein Kurzzeitgedächtnis für kürzlich gewählte Aktionen. (2) H-Werte speichern langfristig nützliche Verknüpfungen zwischen Perzepten und Aktionen. (3) Die Policy wird aus den H-Werten abgeleitet und bestimmt, wie wahrscheinlich Nova bei jedem Perzept eine Aktion wählt.",
    nextAction: "Nächste Aktion",
    reviewUpdate: "Sieh dir die hervorgehobene Aktualisierung an und fahre dann mit Lektion 3 fort.",
    continue: "Weiter",
    greenGlow: "Grüner Glow",
    redGlow: "Roter Glow",
    glowExplanation: "zeigt, welche kürzlich verwendeten Perzept-Aktions-Verbindungen Belohnung erhalten können.",
    hExplanation: "sind dauerhafte Verbindungsstärken.",
    goldUpdate: "Goldene Markierungen zeigen die Verbindungen, die gerade belohnt wurden.",
    updateWhenFound: "Sie werden aktualisiert, sobald die Uhr gefunden wird.",
    policyExplanation: "wandelt die vier H-Werte in Wahrscheinlichkeiten für die nächste Aktion um.",
    finishLesson: "Lektion abschließen",
    lesson3Eyebrow: "Lektion 3 · Durch Wiederholung festigen",
    lesson3Title: "Übung macht den Meister!",
    lesson3Summary: "Starte mehrere Trajektorien und beobachte, wie das Vergessen Novas Gedächtnis beeinflusst. Wähle unten eine Einstellung, um die zugehörigen Entscheidungen, die Position und alle drei Gedächtniseigenschaften zu untersuchen.",
    observeTrajectories: "Beobachte die Trajektorien, die Nova nehmen kann.",
    trajectories: "Trajektorien",
    slowForgetting: "Langsames Vergessen",
    fastForgetting: "Schnelles Vergessen",
    instantReward: "Sofortige Belohnung",
    noAction: "Noch keine Aktion",
    watchDecisions: "Beobachte die nächsten Entscheidungen.",
    startPauseTraining: "Starte oder pausiere das Training.",
    pause: "Pause",
    start: "Start",
    restartPractice: "Training neu starten",
    memory: "Gedächtnis",
    glowLearning: "Beobachte, wie aus Glow Lernen wird",
    recentEdges: "kürzlich verwendete Verbindungen leuchten heller.",
    rewardConsolidates: "Belohnung festigt nützliche Verbindungen.",
    strengthsChances: "aktualisierte Stärken werden zu Aktionswahrscheinlichkeiten.",
    learningProgress: "Lernfortschritt",
    progressExplanation: "Wähle einen Regler, um die zugehörige Umgebung und alle drei Gedächtnisansichten anzuzeigen. Die Werte geben die kumulierte Belohnung einschließlich der Schrittkosten an.",
    complete: "abgeschlossen",
    reward: "Belohnung",
    slowRouteNote: "Gefestigte Wege werden mit der Zeit kürzer.",
    fastRouteNote: "Auf längeren Trajektorien geht mehr Belohnung verloren.",
    slow: "Langsam",
    fast: "Schnell",
    trajectoryProgress: "{done} von {total} Trajektorien mit {mode}em Vergessen abgeschlossen",
    coachObservation: "Beobachtung des Coaches",
    observationText: "Wiederholung frischt nützliche Verbindungen auf; schnelleres Vergessen erschwert es, Fortschritte zu bewahren.",
    stopAndCheck: "Trajektorien stoppen & Verständnis prüfen",
    startHint: "Starte eine Trajektorie, um die optionale Verständnisfrage freizuschalten.",
    finalQuestion: "Abschlussfrage beantworten",
    briefing: "Einführung",
    lesson: "Lektion",
    modes: "Modi",
    academyBrand: "Detektivakademie",
    academySubtitle: "Projektive Simulation",
    returnModes: "Zur Modusauswahl zurückkehren",
    adventureProgress: "Fortschritt im Abenteuer",
  },
};

type AdventureText = (typeof ADVENTURE_TEXT)["en"];

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce((result, [key, value]) => result.replace(`{${key}}`, String(value)), template);
}
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

function CharacterSlot({ text, kind = "student", compact = false }: { text: AdventureText; kind?: "guide" | "student"; compact?: boolean }) {
  return (
    <div className={`character-slot ${compact ? "character-slot-compact" : ""}`} aria-label={kind === "guide" ? text.characterStanding : text.detectiveStudent}>
      <div className={`character-art ${kind === "guide" ? "nova-standing-art" : ""}`}>
        {kind === "student" ? <GraduationCap /> : <img src={Nova_standing} alt={text.characterStanding} />}
      </div>
      {!compact && (
        <div className="character-caption">
          <span>{text.detectiveStudentNova}</span>
          <small>{kind === "guide" ? text.newStudent : text.detectiveTraining}</small>
        </div>
      )}
    </div>
  );
}

function NovaFaceMedal({ text }: { text: AdventureText }) {
  return (
    <div className="nova-face-medal" aria-label={text.novaPortrait}>
      <img src={Nova_face} alt="Nova" />
    </div>
  );
}

function AdventureGrid({
  agent,
  text,
  trail = [],
  active = true,
}: {
  agent: Point;
  text: AdventureText;
  trail?: Point[];
  active?: boolean;
}) {
  return (
    <div className="adventure-grid" aria-label={text.gridLabel}>
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
            aria-label={interpolate(text.colorPercept, { row: y + 1, column: x + 1 })}
          >
            <span
              className="cell-object"
              style={{ background: cellColor }}
              aria-label={isWatch ? text.lostWatch : `${text.object}: ${CELL_OBJECTS[index]}`}
              title={isWatch ? text.lostWatch : undefined}
            >
              {CELL_OBJECTS[index]}
            </span>
            {isAgent && (
              <span className={`student-token ${active ? "student-active" : ""}`} title={text.detectiveStudentNova}>
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
  text,
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
  text: AdventureText;
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
    <div className="memory-grid" aria-label={interpolate(text.memoryShown, { view: view === "glow" ? text.glow : view === "h" ? text.hValues : text.policy })}>
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
                    title={`${text.actions[action]}: ${value.toFixed(2)}`}
                  >
                    <span className="memory-arrow-glyph">{ARROWS[action]}</span>
                    {showValues && <small>{view === "policy" ? `${Math.round(value * 100)}%` : value.toFixed(1)}</small>}
                  </span>
                );
              })}
              {showAgent && focused && <img className="memory-agent-marker" src={Nova_face} alt={text.novaPosition} />}
            </div>
          );
        }),
      )}
    </div>
  );
}

function ProbabilityInset({ probabilities, text }: { probabilities: number[]; text: AdventureText }) {
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
        <div><strong>{text.probabilityExplorer}</strong><small>{text.probabilitySubtitle}</small></div>
        <div className="probability-switch" role="tablist" aria-label={text.probabilityVisualization}>
          <button className={mode === "bars" ? "active" : ""} onClick={() => setMode("bars")}>{text.bars}</button>
          <button className={mode === "beads" ? "active" : ""} onClick={() => setMode("beads")}>{text.beads}</button>
        </div>
      </div>
      {mode === "bars" ? (
        <div className="probability-bars">
          {probabilities.map((chance, index) => (
            <div className="probability-bar" key={ACTIONS[index]}>
              <span>{ARROWS[index]} {text.actions[index]}</span>
              <i><b style={{ width: `${chance * 100}%`, background: ACTION_COLORS[index] }} /></i>
              <strong>{Math.round(chance * 100)}%</strong>
            </div>
          ))}
        </div>
      ) : (
        <div className="bead-view">
          <div className="bead-jar" aria-label={text.beadJar}>
            {beads.map((action, index) => <i style={{ background: ACTION_COLORS[action] }} key={index} />)}
          </div>
          <p>{text.beadExplanation}</p>
        </div>
      )}
      <div className="action-legend">
        {ACTIONS.map((action, index) => <span key={action}><i style={{ background: ACTION_COLORS[index] }} />{ARROWS[index]} {text.actions[index]}</span>)}
      </div>
    </aside>
  );
}

function SampleHistogram({ counts, lastAction, text }: { counts: number[]; lastAction: number | null; text: AdventureText }) {
  const total = counts.reduce((sum, count) => sum + count, 0);

  return (
    <div className="sample-histogram" aria-label={interpolate(text.sampleHistogram, { count: total })}>
      <div className="sample-histogram-heading">
        <div className="sample-histogram-title">
          <strong>{text.sampledActions}</strong>
          {lastAction !== null && (
            <span className="last-sampled-action">
              {text.lastAction}: <b style={{ color: ACTION_COLORS[lastAction] }}><i>{ARROWS[lastAction]}</i> {text.actions[lastAction]}</b>
            </span>
          )}
        </div>
        <span>{total} {total === 1 ? text.sample : text.samples}</span>
      </div>
      {counts.map((count, index) => {
        const frequency = total ? count / total : 0;
        return (
          <div className="sample-histogram-row" key={ACTIONS[index]}>
            <span style={{ color: ACTION_COLORS[index] }}>{ARROWS[index]} {text.actions[index]}</span>
            <i><b style={{ width: `${frequency * 100}%`, background: ACTION_COLORS[index] }} /></i>
            <strong>{Math.round(frequency * 100)}%</strong>
          </div>
        );
      })}
    </div>
  );
}

function MemoryTabs({ value, onChange, text }: { value: MemoryView; onChange: (view: MemoryView) => void; text: AdventureText }) {
  return (
    <div className="memory-tabs" role="tablist" aria-label={text.memoryRepresentation}>
      {(["glow", "h", "policy"] as MemoryView[]).map((view) => (
        <button className={value === view ? "active" : ""} onClick={() => onChange(view)} key={view} role="tab">
          {view === "glow" ? text.glow : view === "h" ? text.hValues : text.policy}
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
  text,
  onBack,
  onContinue,
  final = false,
}: {
  config: QuizConfig;
  text: AdventureText;
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
            <p><strong>{correct ? text.exactly : text.notQuite}</strong> {config.explanation}</p>
          </div>
        )}
        <div className="quiz-actions">
          <button className="button-secondary" onClick={onBack}><ArrowLeft /> {text.previousLesson}</button>
          <button className="button-primary" onClick={onContinue} disabled={!correct}>
            {final ? text.openLabMode : text.nextLesson} <ArrowRight />
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeLevel({ onNext, onSkip, text }: { onNext: () => void; onSkip: () => void; text: AdventureText }) {
  return (
    <section className="story-page">
      <div className="story-copy">
        <span className="story-eyebrow"><Compass /> {text.newCase}</span>
        <h1>{text.welcomeTitle}</h1>
        <p className="story-lead">{text.welcomeLead}</p>
        <div className="story-note">
          <Sparkles />
          <p><strong>{text.yourTask}</strong> {text.taskDescription}</p>
        </div>
        <p>{text.welcomeStory}</p>
        <div className="story-actions">
          <button className="button-primary" onClick={onNext}>{text.meetNova} <ArrowRight /></button>
          <button className="button-text" onClick={onSkip}>{text.skipStory}</button>
        </div>
      </div>
      <CharacterSlot kind="guide" text={text} />
    </section>
  );
}

function LoopLevel({ onPrevious, onComplete, text }: { onPrevious: () => void; onComplete: () => void; text: AdventureText }) {
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
        <div><span className="story-eyebrow"><Footprints /> {text.lesson1Eyebrow}</span><h1>{text.lesson1Title}</h1></div>
        <NovaFaceMedal text={text} />
      </div>
      <p className="lesson-summary">{text.lesson1Summary}</p>


      <div className="loop-layout">
        <div className={`lesson-panel ${phase === "environment" ? "panel-active" : ""}`}>
          <div className="panel-heading"><span>1</span><div><strong>{text.trainingRoom} </strong><small>{text.environmentDescription}</small></div></div>
          <div className="instruction-strip"><Eye /><span><strong>{text.lookFirst}</strong> {text.lookInstruction}</span></div>
          <AdventureGrid agent={agent} text={text} />
          <div className="loop-key"><span className="mini-student"><Search /></span> {text.studentBottomLeft} <ChevronRight /> <Clock3 /> {text.watchTopRight}</div>
        </div>

        <div className="loop-arrow" aria-hidden>{text.percept} <ArrowRight /> <ArrowLeft /> {text.action} </div>

        <div className={`lesson-panel ${phase === "memory" ? "panel-active" : "panel-muted"}`}>
          <div className="panel-heading lesson-one-memory-heading"><span><Brain /></span><div><strong>{text.novaMemory}</strong><small>{text.associationDescription}</small></div></div>
          <div className="interaction-bar">
            <span><strong>{text.yourAction}</strong>{phase === "environment" ? text.openMemoryPrompt : text.drawActionPrompt}</span>
            {phase === "environment" ? (
              <button className="button-primary" onClick={() => setPhase("memory")}>{text.openMemory} <ArrowRight /></button>
            ) : (
              <button className="button-primary" onClick={sampleAction}><Sparkles /> {text.sampleAction}</button>
            )}
          </div>
          {phase === "environment" ? (
            <div className="memory-locked">
              <Brain />
              <p>{text.memoryLocked}</p>
            </div>
          ) : (
            <>
              <div className="memory-and-probability">
                <MemoryGrid memory={memory} view="policy" focus={START} showValues={false} colorActions emphasizeStrength showAgent text={text} />
                <ProbabilityInset probabilities={startPolicy} text={text} />
              </div>
              <div className="sample-box">
                <SampleHistogram counts={sampleCounts} lastAction={sampled} text={text} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="lesson-footer">
        <button className="button-text" onClick={onPrevious}><ArrowLeft /> {text.back}</button>
        <button className="button-primary" disabled={sampled === null} onClick={() => setShowQuiz(true)}>{text.checkUnderstanding} <ArrowRight /></button>
      </div>
      {showQuiz && <QuizModal config={text.quizzes[0]} text={text} onBack={() => { setShowQuiz(false); onPrevious(); }} onContinue={onComplete} />}
    </section>
  );
}

type ComparisonMode = "slow" | "fast";

function GlowComparison({
  steps,
  selected,
  onSelect,
  text,
}: {
  steps: number;
  selected: ComparisonMode;
  onSelect: (mode: ComparisonMode) => void;
  text: AdventureText;
}) {
  const samples = Array.from({ length: Math.min(7, steps + 1) }, (_, index) => index);
  const age = Math.max(0, steps - 1);
  const slowCredit = Math.pow(0.9, age) * 1.4;
  const fastCredit = Math.pow(0.3, age) * 1.4;
  return (
    <div className="comparison-card">
      <div className="comparison-title"><Footprints /> {text.comparisonTitle}</div>
      <button className={`decay-row ${selected === "slow" ? "selected" : ""}`} onClick={() => onSelect("slow")} aria-pressed={selected === "slow"}>
        <span><strong>η = 0.10</strong><small>{text.slowDecay} · {text.firstStepUpdate} +{slowCredit.toFixed(2)}</small></span>
        <span className="decay-dots">{samples.map((sampleAge) => <i style={{ opacity: Math.pow(0.9, samples.length - sampleAge - 1) }} key={sampleAge} />)}<em aria-hidden /></span>
      </button>
      <button className={`decay-row ${selected === "fast" ? "selected" : ""}`} onClick={() => onSelect("fast")} aria-pressed={selected === "fast"}>
        <span><strong>η = 0.70</strong><small>{text.fastDecay} · {text.firstStepUpdate} +{fastCredit.toFixed(2)}</small></span>
        <span className="decay-dots fast">{samples.map((sampleAge) => <i style={{ opacity: Math.max(0.08, Math.pow(0.3, samples.length - sampleAge - 1)) }} key={sampleAge} />)}<em aria-hidden /></span>
      </button>
      <p>{text.decayExplanation}</p>
    </div>
  );
}

function GlowLevel({ onPrevious, onComplete, text }: { onPrevious: () => void; onComplete: () => void; text: AdventureText }) {
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
        <div><span className="story-eyebrow"><Footprints /> {text.lesson2Eyebrow}</span><h1>{text.lesson2Title}</h1></div>
        <NovaFaceMedal text={text} />
      </div>
      <p className="lesson-summary">{text.lesson2Summary}</p>

      <div className="learning-layout">
        <div className="lesson-panel environment-panel">
          <div className="panel-heading panel-heading-with-counter"><span><Search /></span><div><strong>{text.trainingRoom}</strong><small>{text.followNova}</small></div><div className="card-counter"><strong>{steps}</strong><small>{text.steps}</small></div></div>
          <div className="interaction-bar step-controls">
            <span><strong>{text.yourAction}</strong>{reached ? text.watchRecovered : text.advanceDecision}</span>
            <button className="button-primary" onClick={takeStep} disabled={reached}><Footprints /> {text.takeStep}</button>
            <button className="icon-button" onClick={reset} title={text.resetTrip}><RotateCcw /></button>
          </div>
          <AdventureGrid agent={agent} trail={trail} active={!reached} text={text} />
          {reached && <div className="success-note"><Trophy /> <span><strong>{text.watchRecoveredTitle}</strong> {text.compareMemory}</span></div>}
        </div>

        <div className="lesson-panel memory-panel-wide">
          <div className="panel-heading"><span><Brain /></span><div><strong>{text.memoryAssociations}</strong><small>{text.memoryFunctions}</small></div></div>
          {reached && (
            <div className="interaction-bar completion-bar">
              <span><strong>{text.nextAction}</strong>{text.reviewUpdate}</span>
              <button className="button-primary" onClick={() => setShowQuiz(true)}>{text.continue} <ArrowRight /></button>
            </div>
          )}
          <MemoryTabs value={view} onChange={setView} text={text} />
          <div className={`memory-setting-label ${decayMode}`}>{decayMode === "slow" ? `${text.greenGlow} · η = 0.10` : `${text.redGlow} · η = 0.70`}</div>
          <MemoryGrid memory={memories[decayMode]} view={view} focus={agent} highlightUpdates={reached} glowColor={decayMode === "slow" ? "green" : "red"} text={text} />
          <div className="view-explanation">
            {view === "glow" && <><strong>{text.glow}</strong> {text.glowExplanation}</>}
            {view === "h" && <><strong>{text.hValues}</strong> {text.hExplanation} {reached ? text.goldUpdate : text.updateWhenFound}</>}
            {view === "policy" && <><strong>{text.policy}</strong> {text.policyExplanation}</>}
          </div>
        </div>
      </div>
      <GlowComparison steps={steps} selected={decayMode} onSelect={setDecayMode} text={text} />
      <div className="lesson-footer">
        <button className="button-text" onClick={onPrevious}><ArrowLeft /> {text.previousLesson}</button>
        <button className="button-primary" disabled={!reached} onClick={() => setShowQuiz(true)}>{text.finishLesson} <ArrowRight /></button>
      </div>
      {showQuiz && <QuizModal config={text.quizzes[1]} text={text} onBack={() => { setShowQuiz(false); onPrevious(); }} onContinue={onComplete} />}
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

function PracticeLevel({ onPrevious, onComplete, text }: { onPrevious: () => void; onComplete: () => void; text: AdventureText }) {
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
        <div><span className="story-eyebrow"><Trophy /> {text.lesson3Eyebrow}</span><h1>{text.lesson3Title}</h1></div>
        <NovaFaceMedal text={text} />
      </div>
      <p className="lesson-summary">{text.lesson3Summary}</p>

      <div className="practice-layout">
        <div className="lesson-panel practice-environment">
          <div className="panel-heading panel-heading-with-counter"><span><Search /></span><div><strong>{text.trainingRoom} </strong><small>{text.observeTrajectories}</small></div><div className="card-counter"><strong>{activePractice.recovered}/{targetRecoveries}</strong><small>{text.trajectories}</small></div></div>
          <div className={`memory-setting-label ${forgettingMode}`}>{forgettingMode === "slow" ? `${text.slowForgetting} · γ = 0.0001 · η = 0.05` : `${text.fastForgetting} · γ = 0.1 · η = 0.05`}</div>
          <div className="reward-readout">
            <span>{text.instantReward}</span>
            <strong className={activePractice.instantReward > 0 ? "positive" : ""}>
              {activePractice.lastAction ? `${ARROWS[ACTIONS.indexOf(activePractice.lastAction)]} ${text.actions[ACTIONS.indexOf(activePractice.lastAction)]}` : text.noAction}
              <b>{activePractice.instantReward >= 0 ? "+" : ""}{activePractice.instantReward.toFixed(2)}</b>
            </strong>
          </div>
          <div className="interaction-bar practice-controls">
            <span><strong>{text.yourAction}</strong>{running ? text.watchDecisions : text.startPauseTraining}</span>
            <div>
              <button className="button-primary" onClick={() => setRunning((value) => !value)} disabled={activeFinished}>
                {running ? <><Pause /> {text.pause}</> : <><Play /> {activePractice.recovered ? text.continue : text.start}</>}
              </button>
              <button className="icon-button" onClick={reset} title={text.restartPractice}><RotateCcw /></button>
            </div>
          </div>
          <AdventureGrid agent={activePractice.agent} trail={activePractice.trail} active={running && activePractice.rewardPauseTicks === 0} text={text} />
        </div>

        <div className="lesson-panel practice-memory">
          <div className="panel-heading"><span><Brain /></span><div><strong>{text.memory}</strong><small>{text.glowLearning}</small></div></div>
          <MemoryTabs value={view} onChange={setView} text={text} />
          <MemoryGrid memory={activePractice.memory} view={view} focus={activePractice.agent} glowColor={forgettingMode === "slow" ? "green" : "red"} emphasizeStrength text={text} />
          <div className="view-explanation">
            {view === "glow" && <><strong>{text.glow}:</strong> {text.recentEdges}</>}
            {view === "h" && <><strong>{text.hValues}:</strong> {text.rewardConsolidates}</>}
            {view === "policy" && <><strong>{text.policy}:</strong> {text.strengthsChances}</>}
          </div>
        </div>

        <div className="forgetting-panel practice-progress">
          <div className="comparison-title"><Trophy /> {text.learningProgress}</div>
          <p>{text.progressExplanation}</p>
          <button className={`memory-meter slow-meter ${forgettingMode === "slow" ? "selected" : ""}`} onClick={() => selectForgettingMode("slow")} aria-pressed={forgettingMode === "slow"}>
            <div><span><strong>{text.slowForgetting}</strong><small>γ = 0.0001 {completedModels.slow ? `· ${text.complete}` : ""}</small></span><b>Σ {text.reward} {practice.slow.cumulativeReward.toFixed(2)}</b></div>
            <div className="meter-track reward-track"><i style={{ left: `${Math.min(50, slowPosition)}%`, width: `${Math.abs(slowPosition - 50)}%` }}><em className={slowPosition < 50 ? "negative" : ""} /></i></div>
            <small>{text.slowRouteNote}</small>
          </button>
          <button className={`memory-meter fast-meter ${forgettingMode === "fast" ? "selected" : ""}`} onClick={() => selectForgettingMode("fast")} aria-pressed={forgettingMode === "fast"}>
            <div><span><strong>{text.fastForgetting}</strong><small>γ = 0.1 {completedModels.fast ? `· ${text.complete}` : ""}</small></span><b>Σ {text.reward} {practice.fast.cumulativeReward.toFixed(2)}</b></div>
            <div className="meter-track reward-track"><i style={{ left: `${Math.min(50, fastPosition)}%`, width: `${Math.abs(fastPosition - 50)}%` }}><em className={fastPosition < 50 ? "negative" : ""} /></i></div>
            <small>{text.fastRouteNote}</small>
          </button>
          <div className="model-trajectory-counters">
            <div className="trajectory-counter-row slow-trajectory-row">
              <span>{text.slow}</span>
              <div className="episode-dots" aria-label={interpolate(text.trajectoryProgress, { done: practice.slow.recovered, total: targetRecoveries, mode: text.slow.toLowerCase() })}>
                {Array.from({ length: targetRecoveries }, (_, index) => <i className={index < practice.slow.recovered ? "complete" : ""} key={index}>{index + 1}</i>)}
              </div>
            </div>
            <div className="trajectory-counter-row fast-trajectory-row">
              <span>{text.fast}</span>
              <div className="episode-dots" aria-label={interpolate(text.trajectoryProgress, { done: practice.fast.recovered, total: targetRecoveries, mode: text.fast.toLowerCase() })}>
                {Array.from({ length: targetRecoveries }, (_, index) => <i className={index < practice.fast.recovered ? "complete" : ""} key={index}>{index + 1}</i>)}
              </div>
            </div>
          </div>
          <div className="academy-tip"><Lightbulb /><span><strong>{text.coachObservation}</strong> {text.observationText}</span></div>
        </div>
      </div>

      <div className="lesson-footer">
        <button className="button-text" onClick={onPrevious}><ArrowLeft /> {text.previousLesson}</button>
        {!finished ? (
          hasPracticeStarted ? (
            <button className="button-secondary" onClick={stopAndCheckUnderstanding}>
              <Pause /> {text.stopAndCheck}
            </button>
          ) : (
            <span className="finish-hint">{text.startHint}</span>
          )
        ) : (
          <button className="button-primary" onClick={() => setShowQuiz(true)}>
            {text.finalQuestion} <ArrowRight />
          </button>
        )}
      </div>
      {showQuiz && <QuizModal config={text.quizzes[2]} text={text} onBack={() => { setShowQuiz(false); onPrevious(); }} onContinue={onComplete} final />}
    </section>
  );
}

export default function AdventureMode({
  onHome,
  onOpenLab,
  language,
  onLanguageChange,
}: {
  onHome: () => void;
  onOpenLab: () => void;
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
}) {
  const [level, setLevel] = useState(0);
  const text = ADVENTURE_TEXT[language];

  function goTo(next: number) {
    setLevel(Math.max(0, Math.min(3, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="adventure-shell">
      <header className="adventure-header">
        <button className="academy-brand" onClick={onHome} aria-label={text.returnModes}>
          <span><Search /></span><div><strong>{text.academyBrand}</strong><small>{text.academySubtitle}</small></div>
        </button>
        <nav className="adventure-progress" aria-label={text.adventureProgress}>
          {text.levelTitles.map((title, index) => (
            <button className={`${index === level ? "current" : ""} ${index < level ? "complete" : ""}`} onClick={() => index <= level && goTo(index)} key={title} title={title}>
              {index < level && <Check />}
              <span>{index === 0 ? text.briefing : `${text.lesson} ${index}`}</span>
            </button>
          ))}
        </nav>
        <div className="adventure-header-actions">
          <button className="header-home" onClick={onHome}><Home /> <span>{text.modes}</span></button>
          <LanguageToggle language={language} onChange={onLanguageChange} className="adventure-language-toggle" />
        </div>
      </header>

      <div className="adventure-content">
        {level === 0 && <WelcomeLevel onNext={() => goTo(1)} onSkip={() => goTo(1)} text={text} />}
        {level === 1 && <LoopLevel onPrevious={() => goTo(0)} onComplete={() => goTo(2)} text={text} />}
        {level === 2 && <GlowLevel onPrevious={() => goTo(1)} onComplete={() => goTo(3)} text={text} />}
        {level === 3 && <PracticeLevel onPrevious={() => goTo(2)} onComplete={onOpenLab} text={text} />}
      </div>
    </main>
  );
}
