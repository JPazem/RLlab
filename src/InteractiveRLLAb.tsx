import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Slider } from "./components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
// import { Switch } from "./components/ui/switch";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, AreaChart, Area, Label as ChartLabel } from "recharts";
import { Play, Pause, RotateCcw, Brain, Trophy, CirclePlay, HelpCircle, BookOpen, Info, X, KeyRound, DoorClosedLocked, DoorOpen, Lightbulb, Search, Home, Footprints } from "lucide-react";
import { motion } from "framer-motion";
import qrCode from "./assets/QR_Code_RLGame_Outreach.png";
import LanguageToggle, { type AppLanguage } from "./LanguageToggle";
import { MemoryGrid, MemoryTabs, type MemoryView } from "./AcademyMemory";
import { LAB_STORY_TEXT } from "./academyLabText";
import { labPolicy } from "./labPolicy";
import { timelyPathProbability, type PathAssessment } from "./shortestPathProbability";
import { LAB_COLORS, LAB_OBJECTS, makeLabMemory, makeLabPercepts, makeLevelTwoComparisonMemory, perceptId, perceptObject, replacePerceptValue, type LabPercepts } from "./labPercepts";
import NovaFace from "./assets/Nova_Portrait.png";
import NovaStanding from "./assets/Nova_Standing_noBackground.png";
import CoachStanding from "./assets/Coach_Standing.png";
import CoachPortrait from "./assets/Coach_Portrait.png";
import { LOG_PARAMETER_MARKS, LOG_SLIDER_MAX, parameterToSlider, sliderToParameter } from "./logParameterScale";
import { PSLayer } from "./psMemory";

console.log("InteractiveRLLab render", Date.now());

const ACTIONS = ["up", "right", "down", "left"] as const;
type Action = typeof ACTIONS[number];
type Locale = "en" | "de" | "it" | "fr" | "es";
const KEY_IDS = ["blue", "red", "green"] as const;
type KeyId = typeof KEY_IDS[number];
type KeyCell = `key-${KeyId}`;
type DoorClosedCell = `door-${KeyId}-closed`;
type DoorOpenCell = `door-${KeyId}-open`;
type DoorCell = DoorClosedCell | DoorOpenCell;

type CellType =
  | "empty"
  | "wall"
  | "goal"
  | "trap"
  | "start"
  | KeyCell
  | DoorClosedCell
  | DoorOpenCell;

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
    greediness: number;
    stepCost: number;
    goalReward: number;
    trapPenalty: number;
  }>;
  adjustableParams: string[]; // parameter names that user can adjust
  instructions: string;
};

// Each case starts from a predictable baseline; the visible controls determine
// which parameters students can tune in that case.
const FINAL_LAB_PARAMETERS = { psLambda: 1, psGamma: 0.01, psGlowEta: 0.05, greediness: 0.75, stepCost: -0.02, goalReward: 10, trapPenalty: -1 };
const BETA_SETTINGS = [0.01, 0.75, 5] as const;
type PlaybackMode = "click" | "slow" | "fast" | "immediate";
type EpisodeEnd = "goal" | "trap" | "limit";
type LabDecision = { percept: { x: number; y: number }; action: number };
type RewardBreakdown = { steps: number; watch: number; key: number; door: number };
type CaseThreeAssessments = { key: PathAssessment; door: PathAssessment; watch: PathAssessment };
const EPISODE_PAUSE_MS = 1000;
const EMPTY_REWARD_BREAKDOWN: RewardBreakdown = { steps: 0, watch: 0, key: 0, door: 0 };

const LEVELS: LevelConfig[] = [
  {
    id: 1,
    name: "Tune the memory yourself!",
    description: "Use glow and forgetting to help Nova recover the watch quickly.",
    preset: "open",
    gridW: 4,
    gridH: 4,
    lockedParams: { psLambda: 1, psGamma: 0.02, greediness: 0.75, stepCost: -0.02, goalReward: 10, trapPenalty: -1 },
    adjustableParams: ["psGamma", "psGlowEta"],
    instructions: "Nova is in a larger training room. Tune glow and forgetting for Nova to find the watch as fast as possible."
  },
  {
    id: 2,
    name: "Nova sees the world differently!",
    description: "Repeated colors share one memory, even at different positions.",
    preset: "open",
    gridW: 4,
    gridH: 4,
    lockedParams: { psLambda: 1, psGamma: 0.005, psGlowEta: 0.08, greediness: 0.75, stepCost: -0.05, goalReward: 10, trapPenalty: -1 },
    adjustableParams: [],
    instructions: "Nova sees only a few colors, and several cells look identical to her. Watch the shared percept-action graph and map. After five trajectories, compare exploration settings."
  },
  {
    id: 3,
    name: "You are the boss! Tune all memory parameters in one go!",
    description: "Find the key, open the door, and recover the watch.",
    preset: "two-rooms",
    gridW: 7,
    gridH: 5,
    lockedParams: { psLambda: 1, psGamma: 0.01, psGlowEta: 0.05, greediness: 0.75, stepCost: -0.05, goalReward: 10, trapPenalty: -1 },
    adjustableParams: ["psGamma", "psGlowEta", "greediness"],
    instructions: "You are the boss! Tune all memory parameters in one go! Nova sees colors, objects, and whether she has the key. Help her reach the key with at least 75% probability within two steps of the shortest route, then open the door to find the watch."
  },
  {
    id: 4,
    name: "Create new challenges to test Nova's capabilities",
    description: "Design a room, then train Nova to solve it efficiently.",
    preset: "open",
    gridW: 4,
    gridH: 4,
    lockedParams: { ...FINAL_LAB_PARAMETERS },
    adjustableParams: ["stepCost", "goalReward", "trapPenalty", "psGamma", "psGlowEta", "greediness"],
    instructions: "Create new challenges to test Nova's capabilities. Change the room size, walls, percepts, keys, doors, watch, trap, and rewards. Then tune Nova's memory until the chance of reaching the watch within two steps of the shortest route is at least 75%."
  }
];

const UI_TEXT: Record<Locale, any> = {
  en: {
    appTitle: "Detective Academy · Research lab",
    appSubtitle: "Design Nova’s training room and investigate how she learns.",
    language: "Language",
    generalConcepts: "General Concepts",
    generalSections: [
      {
        title: "Reinforcement Learning (RL)",
        body: "A machine learning paradigm where an agent learns by interacting with an environment, receiving rewards for actions, and learning to maximize cumulative reward over time. It is used in many fields, ranging from robotics to game playing, and is inspired by how animals learn from their environment."
      },
      {
        title: "Projective Simulation (PS)",
        body: 'A learning algorithm that models decision-making as a random walk on a graph. The memory of the agent is represented as a network of memories, called "clips", that represent experiences the agent had in its environment. These clips are connected in a network, and the more an agent reexperiences a particular transition between clips and gets a positive reward for it, the stronger the connection between these events becomes. To decide which action to take, the agent revisits memories randomly, where a memory is more likely to be revisited if it has a strong connection to the clip the agent is currently in. This allows the agent to learn which sequences of actions lead to rewards and to make decisions based on past experiences.'
      },
      {
        title: "Environment",
        body: "You are Nova’s coach at the Detective Academy. Build a training room where she learns to recover a lost watch while avoiding hazards. The watch reward starts at 10 points. Nova perceives colors and objects, and in later levels whether she has a key. Cells with the same percept share one memory.",
        items: [
          { label: "Nova:", body: "The detective student who learns by exploring" },
          { label: "Lost watch (⌚):", body: "The goal where Nova receives a reward, initially 10" },
          { label: "Trap (🧨):", body: "A penalty zone that the agent learns to avoid" },
          { label: "Walls:", body: "Obstacles the agent cannot pass through" },
          { label: "Reward:", body: "Feedback signal that guides learning" }
        ]
      },
      {
        title: "Three views of Nova’s memory",
        body: "Glow tracks recent choices; H-values store learned strengths; policy shows the action probabilities, controlled solely by inverse temperature β. Switch between the tabs without resetting Nova’s training. Thicker arrows indicate stronger values; the numbers remain readable."
      }
    ],
    psModalTitle: "Projective Simulation (PS)",
    psSections: [
      {
        title: "Overview",
        body: "Projective Simulation models decision-making as a random walk over a network of “clips” (memories of percepts and actions). Learning strengthens connections that lead to rewards, shaping the agent’s policy over time."
      },
      {
        title: "How It Learns",
        body: "Each experience updates the clip network. Rewards increase the likelihood of choosing actions that previously led to success, while decay parameters control how quickly old experiences fade."
      },
      {
        title: "Memory Parameters",
        body: "",
        items: [
          { label: "Forgetting (γ):", body: "How quickly the agent forgets past experiences." },
          { label: "Reward sensitivity (λ):", body: "How strongly rewards reinforce connections between memories." },
          { label: "Glow decay (η):", body: "How fast the memory of recent transition fades. It enables the agent to learn in environments with sparse rewards." }
        ]
      },
      {
        title: "Why It Matters",
        body: "These parameters shape how the agent balances short-term rewards with long-term learning, influencing how quickly it discovers better strategies."
      },
      {
        title: "How does the agent learn?",
        body: "The agent learns by updating its memory network based on experiences. When it takes an action and receives a reward, the connections between the corresponding memories are strengthened, guiding future decisions."
      }
    ],
    levelLabel: "Case",
    levelInstructions: "Level Instructions",
    winCondition: "Win Condition",
    lockedParameters: "Locked Parameters",
    howToPlay: "How to Play",
    howToPlayItems: [
      { label: "Run the simulation:", body: "Click the play button to start training" },
      { label: "Adjust parameters:", body: "Use the sliders to tune the adjustable parameters above" },
      { label: "Monitor learning:", body: "Watch the policy arrows and reward curves update" },
      { label: "Achieve the win condition:", body: "Case 1 requires at least 75% probability of a shortest route to the watch. Case 3 requires 75% for the key, the door, and the shortest route from the door to the watch. Case 4 evaluates the watch with two extra steps. Case 2 ends with an exploration quiz." },
      { label: "Advance:", body: "Complete the level to unlock the next challenge!" }
    ],
    levelComplete: "complete",
    advancingTo: "Advancing to",
    nextLevelButton: "Go to Next Case",
    congratulations: "Congratulations",
    rlMaster: "Nova has completed all academy cases. Keep experimenting with her training in free play.",
    continueFreePlay: "Continue in Free Play",
    freePlayMenu: "Free Play",
    freePlayActive: "Free play is active. The campaign is finished, but the simulation remains available.",
    run: "Run",
    pause: "Pause",
    resetLevel: "Reset Case",
    resetGame: "Reset Game",
    buildEnvironment: "Build your Environment!",
    memoryTitle: "Memory of the PS Agent",
    learnMorePS: "Learn more about projective simulation",
    tuneAgent: "Tune the agent to make it learn!",
    rewardsTitle: "Learning Curves",
    tipsTitle: "Learning Tips",
    tipsButton: "Open learning tips",
    tipsModalTitle: "Learning Tips and Parameter Guide",
    tipsLead: "Quick cheat sheet for helping the agent learn.",
    strugglingTitle: "Need a hint?",
    optimalParamsTitle: "Good parameter ranges",
    optimalParamsLead: "These are practical near-optimal starting ranges for most levels, then fine-tune from there.",
    level: "Case",
    preset: "Preset",
    keyStatus: "Key status",
    keyStatusCollected: "Collected keys",
    keyStatusAvailable: "Keys on grid",
    keyStatusUnused: "No keys on this grid",
    keyStatusMissing: "Door present but its key is missing",
    addChallenges: "Add new challenges",
    width: "Width",
    height: "Height",
    apply: "Apply",
    stepsPerSecond: "Steps/sec",
    stepCost: "Step cost",
    goalReward: "Watch recovery reward",
    trapPenalty: "Trap penalty",
    envSliderHelp: {
      speed: "Speed of simulation. Higher values run more episodes per second.",
      stepCost: "Penalty for each step taken. Negative values encourage the agent to find shorter paths to the goal.",
      goalReward: "Positive reward when Nova recovers a lost watch. Larger values make recovery more attractive.",
      trapPenalty: "Entering a trap ends the episode with a penalty. More negative values discourage risky routes."
    },
    paramLabels: {
      psGamma: "Forgetting (γ)",
      psLambda: "Reward sensitivity (λ)",
      psGlowEta: "Glow decay (η)",
    },
    paramHelp: {
      psGamma: (
        <ul className="pl-4 space-y-1">
          <p>How quickly the agent forgets connections between past experiences:</p><strong>
          <li>Lower values = longer memory</li>
          <li>Higher values = faster forgetting</li></strong>
        </ul>
      ),
      psLambda: (
        <ul className="pl-4 space-y-1">
          <p>Scales how strongly rewards influence learning:</p>
          <li><strong> Higher values = bigger updates.</strong></li>
        </ul>
      ),
      psGlowEta: (
        <ul className="pl-4 space-y-1">
          <p>Controls how quickly temporary activation patterns fade. It enables the agent to learn in environments with sparse rewards:</p>
          <strong>
          <li>Higher values = Short memory of past actions</li>
          <li>Smaller values = Keep track of more actions</li>
          </strong>
        </ul>
      ),
    },
    rewardCharts: {
      instant: "Instantaneous Reward (R)",
      cumulative: "Cumulative Reward (C)",
      episode: "Episode Return (G)",
      instantHelp: "Shows rewards received at each time step during learning.",
      cumulativeHelp: "Total reward accumulated over all time steps - measures overall learning progress.",
      episodeHelp: "Total reward accumulated in each episode - increasing trends show the agent is learning better policies."
    },
    stats: {
      episode: "Episode",
      currentReturn: "Current G",
      totalReturn: "Total return"
    },
    presetLabels: {
      open: "Open Field",
      corridor: "Corridor",
      "two-rooms": "Two Rooms",
      maze: "Maze"
    },
    keyColors: {
      blue: "Blue",
      red: "Red",
      green: "Green"
    },
    keyBrushLabel: "Key",
    doorBrushLabel: "Door",
    openDoorBrushLabel: "Open door",
    cellLabels: {
      wall: "Wall",
      empty: "Empty",
      goal: "Lost watch ⌚",
      trap: "Trap",
      start: "Start"
    }
  },
  de: {
    appTitle: "Detektivakademie · Forschungslabor",
    appSubtitle: "Gestalte Novas Trainingsraum und untersuche ihr Lernen.",
    language: "Sprache",
    generalConcepts: "Allgemeine Konzepte",
    generalSections: [
      { title: "Reinforcement Learning (RL)", body: "Ein Paradigma des maschinellen Lernens, bei dem ein Agent durch Interaktion mit einer Umgebung lernt, Belohnungen für Aktionen erhält und versucht, die kumulative Belohnung zu maximieren. Es wird in Bereichen wie Robotik und Spielstrategien eingesetzt." },
      { title: "Projective Simulation (PS)", body: "Ein Lernverfahren, das Entscheidungen als Zufallsweg auf einem Graphen modelliert. Die Erfahrungen des Agenten werden in Clips gespeichert, und belohnte Übergänge werden im Gedächtnisnetzwerk verstärkt." },
      { title: "Trainingsraum", body: "Du trainierst Nova in der Detektivakademie. Sie soll die verlorene Uhr finden und Gefahren meiden. Nova nimmt Farben und Gegenstände wahr, später auch, ob sie einen Schlüssel hat. Zellen mit demselben Perzept teilen sich ein Gedächtnis. Die Uhr bringt anfangs 10 Punkte." },
      { title: "Drei Ansichten von Novas Gedächtnis", body: "Glow markiert kürzlich gewählte Aktionen, H-Werte speichern erlernte Stärken und die Policy zeigt Aktionswahrscheinlichkeiten gesteuert allein durch die inverse Temperatur β. Du kannst die Ansicht ohne Neustart wechseln. Dickere Pfeile zeigen stärkere Werte; die Zahlen bleiben gut lesbar." }
    ],
    psModalTitle: "Projective Simulation (PS)",
    psSections: [
      { title: "Überblick", body: "Projective Simulation modelliert Entscheidungen als Zufallsweg über ein Netzwerk von Clips, die Wahrnehmungen, Aktionen und kurze Gedächtnisinhalte repräsentieren. Belohnte Übergänge werden verstärkt und formen so die Politik des Agenten." },
      { title: "Lernen", body: "Jede Erfahrung aktualisiert das Clip-Netzwerk. Belohnungen erhöhen die Wahrscheinlichkeit, dass Aktionen wieder gewählt werden, die zuvor zum Erfolg geführt haben, während Zerfallsparameter alte Erfahrungen abschwächen." },
      { title: "Speicherparameter", body: "Vergessen steuert das Vergessen alter Erfahrungen, Belohnungssensitivität skaliert den Einfluss von Belohnungen, und Glow-Abbau bestimmt, wie lange frühere Übergänge noch für verzögerte Belohnungen relevant bleiben." },
      { title: "Warum das wichtig ist", body: "Diese Einstellungen entscheiden darüber, ob der Agent eher kurzfristig oder langfristig lernt, vorsichtig oder aggressiv reagiert und ob er Aufgaben mit verzögerten Belohnungen lösen kann." }
    ],
    levelLabel: "Fall",
    levelInstructions: "Level-Hinweise",
    winCondition: "Siegbedingung",
    lockedParameters: "Gesperrte Parameter",
    howToPlay: "So spielst du",
    howToPlayItems: [
      "Starte die Simulation und beobachte die Erkundung.",
      "Passe die verfügbaren Regler an.",
      "Nutze Speicherpfeile und Belohnungskurven zur Bewertung.",
      "Erreiche in Fall 1 mindestens 75 % Wahrscheinlichkeit für einen kürzesten Weg zur Uhr. Fall 3 verlangt je 75 % für Schlüssel, Tür und den kürzesten Weg von der Tür zur Uhr. Fall 4 bewertet die Uhr mit zwei Zusatzschritten. Fall 2 endet mit einem Quiz.",
      "Schließe ein Level ab, um das nächste freizuschalten."
    ],
    levelComplete: "abgeschlossen",
    advancingTo: "Weiter zu",
    nextLevelButton: "Zum nächsten Fall",
    congratulations: "Glückwunsch",
    rlMaster: "Nova hat alle Fälle der Akademie abgeschlossen. Experimentiere im freien Spiel weiter mit ihrem Training.",
    continueFreePlay: "Freies Spiel starten",
    freePlayMenu: "Freies Spiel",
    freePlayActive: "Freies Spiel ist aktiv. Die Kampagne ist beendet, aber die Simulation läuft weiter.",
    run: "Start",
    pause: "Pause",
    resetLevel: "Fall zurücksetzen",
    resetGame: "Spiel zurücksetzen",
    buildEnvironment: "Baue deine Umgebung",
    memoryTitle: "Gedächtnis des PS-Agenten",
    learnMorePS: "Mehr über Projective Simulation",
    tuneAgent: "Stimme den Agenten ab",
    rewardsTitle: "Lernkurven",
    tipsTitle: "Lerntipps",
    tipsButton: "Lerntipps öffnen",
    tipsModalTitle: "Lerntipps und Parameterhilfe",
    tipsLead: "Kompakte Hilfe, wenn der Agent feststeckt.",
    strugglingTitle: "Brauchst du einen Hinweis?",
    optimalParamsTitle: "Gute Parameterbereiche",
    optimalParamsLead: "Das sind praxistaugliche Startbereiche für die meisten Level.",
    level: "Fall",
    preset: "Voreinstellung",
    keyStatus: "Schlüsselstatus",
    keyStatusCollected: "Gesammelte Schlüssel",
    keyStatusAvailable: "Schlüssel im Gitter",
    keyStatusUnused: "Keine Schlüssel in diesem Gitter",
    keyStatusMissing: "Eine Tür ist vorhanden, aber der passende Schlüssel fehlt",
    addChallenges: "Neue Herausforderungen",
    width: "Breite",
    height: "Höhe",
    apply: "Anwenden",
    stepsPerSecond: "Schritte/s",
    stepCost: "Schrittkosten",
    goalReward: "Belohnung fürs Finden der Uhr",
    trapPenalty: "Fallenstrafe",
    envSliderHelp: {
      speed: "Geschwindigkeit der Simulation. Höhere Werte führen pro Sekunde mehr Episoden aus.",
      stepCost: "Strafe für jeden Schritt. Negative Werte ermutigen den Agenten, kürzere Wege zum Ziel zu finden.",
      goalReward: "Positive Belohnung, wenn Nova eine verlorene Uhr findet. Höhere Werte machen das Finden attraktiver.",
      trapPenalty: "Das Betreten einer Falle beendet die Episode mit einer Strafe. Stärker negative Werte machen riskante Wege unattraktiver."
    },
    paramLabels: {
      psGamma: "Vergessen (γ)",
      psLambda: "Belohnungssensitivität (λ)",
      psGlowEta: "Glow-Abbau (η)",
    },
    paramHelp: {
      psGamma: (
        <ul className="pl-4 space-y-1">
          <p>Wie schnell der Agent Verbindungen zwischen früheren Erfahrungen vergisst:</p><strong>
          <li>Niedrigere Werte = längeres Gedächtnis</li>
          <li>Höhere Werte = schnelleres Vergessen</li></strong>
        </ul>
      ),
      psLambda: (
        <ul className="pl-4 space-y-1">
          <p>Skaliert, wie stark Belohnungen das Lernen beeinflussen:</p>
          <li><strong> Höhere Werte = größere Updates.</strong></li>
        </ul>
      ),
      psGlowEta: (
        <ul className="pl-4 space-y-1">
          <p>Steuert, wie schnell vorübergehende Aktivierungsmuster verblassen. Dadurch kann der Agent auch in Umgebungen mit spärlichen Belohnungen lernen:</p>
          <strong>
          <li>Höhere Werte = kurzes Gedächtnis vergangener Aktionen</li>
          <li>Kleinere Werte = mehr frühere Aktionen bleiben erhalten</li>
          </strong>
        </ul>
      ),
    },
    rewardCharts: {
      instant: "Momentane Belohnung (R)",
      cumulative: "Kumulative Belohnung (C)",
      episode: "Episoden-Return (G)",
      instantHelp: "Zeigt die Belohnung, die während des Lernens in jedem Zeitschritt erhalten wird.",
      cumulativeHelp: "Gesamte Belohnung über alle Zeitschritte hinweg - misst den gesamten Lernfortschritt.",
      episodeHelp: "Gesamte Belohnung pro Episode - steigende Trends zeigen, dass der Agent bessere Politiken lernt."
    },
    stats: {
      episode: "Episode",
      currentReturn: "Aktuelles G",
      totalReturn: "Gesamt-Return"
    },
    presetLabels: {
      open: "Offenes Feld",
      corridor: "Korridor",
      "two-rooms": "Zwei Räume",
      maze: "Labyrinth"
    },
    keyColors: {
      blue: "Blau",
      red: "Rot",
      green: "Grün"
    },
    keyBrushLabel: "Schlüssel",
    doorBrushLabel: "Tür",
    openDoorBrushLabel: "Offene Tür",
    cellLabels: {
      wall: "Wand",
      empty: "Leer",
      goal: "Verlorene Uhr ⌚",
      trap: "Falle",
      start: "Start"
    }
  },
  it: {
    appTitle: "Laboratorio interattivo di Reinforcement Learning",
    appSubtitle: "Vieni ad allenare il tuo agente di reinforcement learning in tempo reale!",
    language: "Lingua",
    generalConcepts: "Concetti generali",
    generalSections: [
      { title: "Reinforcement Learning (RL)", body: "Un paradigma del machine learning in cui un agente impara interagendo con un ambiente, ricevendo ricompense per le azioni e cercando di massimizzare la ricompensa cumulativa nel tempo. Viene usato in robotica, giochi e molti altri ambiti." },
      { title: "Projective Simulation (PS)", body: "Un algoritmo di apprendimento che modella il processo decisionale come una passeggiata casuale su un grafo. Le esperienze dell'agente vengono memorizzate in clip e le transizioni premiate diventano più forti." },
      { title: "Ambiente", body: "Alleniamo un agente PS in un ambiente a griglia in cui deve raggiungere l'obiettivo in modo efficiente evitando i pericoli. A seconda del livello possono comparire muri, trap, chiavi e porte." },
      { title: "Visualizzazione della policy", body: "Il pannello della memoria mostra la policy appresa come frecce. Le frecce più luminose indicano le azioni che l'agente è più propenso a scegliere grazie alle ricompense ricevute." }
    ],
    psModalTitle: "Projective Simulation (PS)",
    psSections: [
      { title: "Panoramica", body: "Projective Simulation modella le decisioni come una passeggiata casuale su una rete di clip che rappresentano percezioni, azioni e brevi frammenti di memoria. Le ricompense rafforzano le transizioni utili e plasmano la policy dell'agente." },
      { title: "Come impara", body: "Ogni esperienza aggiorna la rete di clip. Le ricompense aumentano la probabilità di scegliere di nuovo azioni che hanno portato al successo, mentre i parametri di decadimento fanno svanire gradualmente le esperienze più vecchie." },
      { title: "Parametri di memoria", body: "Lo smorzamento della memoria controlla quanto velocemente l'agente dimentica, l'accoppiamento della ricompensa regola quanto la ricompensa modifica la memoria, e il decadimento del glow stabilisce per quanto tempo le azioni recenti continuano a ricevere credito." },
      { title: "Perché conta", body: "Questi parametri determinano se l'agente impara strategie a breve o lungo termine, se si adatta in modo prudente o aggressivo e se riesce a risolvere compiti con ricompense ritardate." }
    ],
    levelLabel: "Livello",
    levelInstructions: "Istruzioni del livello",
    winCondition: "Condizione di vittoria",
    lockedParameters: "Parametri bloccati",
    howToPlay: "Come giocare",
    howToPlayItems: [
      "Avvia la simulazione e osserva l'esplorazione.",
      "Regola gli slider disponibili.",
      "Usa frecce di memoria e grafici delle ricompense per valutare i progressi.",
      "Raggiungi il target per 5 episodi consecutivi.",
      "Completa un livello per sbloccare il successivo."
    ],
    levelComplete: "Livello completato",
    advancingTo: "Passaggio a",
    nextLevelButton: "Vai al livello successivo",
    congratulations: "Complimenti",
    rlMaster: "Hai completato tutti i livelli. Ora puoi continuare in modalità libera.",
    continueFreePlay: "Continua in free play",
    freePlayMenu: "Gioco libero",
    freePlayActive: "La modalità libera è attiva. La campagna è finita, ma puoi continuare a sperimentare.",
    run: "Avvia",
    pause: "Pausa",
    resetLevel: "Reset livello",
    resetGame: "Reset gioco",
    buildEnvironment: "Costruisci il tuo ambiente",
    memoryTitle: "Memoria dell'agente PS",
    learnMorePS: "Scopri di più sulla Projective Simulation",
    tuneAgent: "Regola l'agente per farlo imparare",
    rewardsTitle: "Curve di apprendimento",
    tipsTitle: "Suggerimenti",
    tipsButton: "Apri i suggerimenti",
    tipsModalTitle: "Suggerimenti e guida ai parametri",
    tipsLead: "Promemoria rapido per aiutare l'agente.",
    strugglingTitle: "Serve un suggerimento?",
    optimalParamsTitle: "Buoni intervalli di parametri",
    optimalParamsLead: "Questi intervalli sono ottimi punti di partenza pratici per la maggior parte dei livelli.",
    level: "Livello",
    preset: "Preimpostazione",
    keyStatus: "Stato della chiave",
    keyStatusCollected: "Chiavi raccolte",
    keyStatusAvailable: "Chiavi nella griglia",
    keyStatusUnused: "Nessuna chiave in questa griglia",
    keyStatusMissing: "È presente una porta ma manca la chiave corretta",
    addChallenges: "Aggiungi nuove sfide",
    width: "Larghezza",
    height: "Altezza",
    apply: "Applica",
    stepsPerSecond: "Passi/sec",
    stepCost: "Costo passo",
    goalReward: "Ricompensa obiettivo",
    trapPenalty: "Penalità trap",
    envSliderHelp: {
      speed: "Velocità della simulazione. Valori più alti eseguono più episodi al secondo.",
      stepCost: "Penalità per ogni passo. Valori negativi incoraggiano l'agente a trovare percorsi più brevi verso l'obiettivo.",
      goalReward: "Ricompensa positiva quando l'agente raggiunge l'obiettivo. Valori più alti rendono l'obiettivo più attraente.",
      trapPenalty: "Ricompensa negativa quando l'agente entra nella trap. Valori più negativi lo spingono a evitarla con più decisione."
    },
    paramLabels: {
      psGamma: "Smorzamento memoria (γ)",
      psLambda: "Accoppiamento ricompensa (λ)",
      psGlowEta: "Decadimento glow (η)",
    },
    paramHelp: {
      psGamma: (
        <ul className="pl-4 space-y-1">
          <p>Quanto rapidamente l'agente dimentica le connessioni tra esperienze passate:</p><strong>
          <li>Valori più bassi = memoria più lunga</li>
          <li>Valori più alti = dimenticanza più veloce</li></strong>
        </ul>
      ),
      psLambda: (
        <ul className="pl-4 space-y-1">
          <p>Scala quanto fortemente le ricompense influenzano l'apprendimento:</p>
          <li><strong> Valori più alti = aggiornamenti più grandi.</strong></li>
        </ul>
      ),
      psGlowEta: (
        <ul className="pl-4 space-y-1">
          <p>Controlla quanto rapidamente svaniscono i pattern di attivazione temporanei. Permette all'agente di imparare anche con ricompense rare:</p>
          <strong>
          <li>Valori più alti = memoria breve delle azioni passate</li>
          <li>Valori più bassi = più azioni passate restano rilevanti</li>
          </strong>
        </ul>
      ),
    },
    rewardCharts: {
      instant: "Ricompensa istantanea (R)",
      cumulative: "Ricompensa cumulativa (C)",
      episode: "Return episodio (G)",
      instantHelp: "Mostra la ricompensa ricevuta a ogni passo temporale durante l'apprendimento.",
      cumulativeHelp: "Ricompensa totale accumulata su tutti i passi temporali - misura il progresso complessivo dell'apprendimento.",
      episodeHelp: "Ricompensa totale accumulata in ogni episodio - andamenti crescenti indicano che l'agente sta imparando politiche migliori."
    },
    stats: {
      episode: "Episodio",
      currentReturn: "G attuale",
      totalReturn: "Return totale"
    },
    presetLabels: {
      open: "Campo aperto",
      corridor: "Corridoio",
      "two-rooms": "Due stanze",
      maze: "Labirinto"
    },
    keyColors: {
      blue: "Blu",
      red: "Rossa",
      green: "Verde"
    },
    keyBrushLabel: "Chiave",
    doorBrushLabel: "Porta",
    openDoorBrushLabel: "Porta aperta",
    cellLabels: {
      wall: "Muro",
      empty: "Vuoto",
      goal: "Obiettivo",
      trap: "Falle",
      start: "Partenza"
    }
  },
  fr: {
    appTitle: "Laboratoire interactif de Reinforcement Learning",
    appSubtitle: "Entraîne ton agent de reinforcement learning en temps réel !",
    language: "Langue",
    generalConcepts: "Concepts généraux",
    generalSections: [
      { title: "Reinforcement Learning (RL)", body: "Un paradigme de machine learning dans lequel un agent apprend en interagissant avec un environnement. Il reçoit des récompenses pour ses actions et en cherchant à maximiser la récompense accumulée au fil du temps." },
      { title: "Projective Simulation (PS)", body: "Un algorithme d'apprentissage qui modélise la prise de décision comme une marche aléatoire sur un graphe. Les expériences de l'agent sont stockées dans des clips, et les transitions récompensées deviennent plus fortes." },
      { title: "Environnement", body: "Nous entraînons un agent PS dans un monde en grille où il doit atteindre un objectif efficacement tout en évitant les dangers. Selon le niveau, la grille peut contenir des murs, de la lave, des clés et des portes." },
      { title: "Visualisation de la politique", body: "Le panneau mémoire montre la politique apprise sous forme de flèches. Les flèches les plus lumineuses correspondent aux actions que l'agent choisira le plus probablement." }
    ],
    psModalTitle: "Projective Simulation (PS)",
    psSections: [
      { title: "Vue d'ensemble", body: "Projective Simulation modélise la prise de décision comme une marche aléatoire sur un réseau de clips représentant perceptions, actions et courts fragments de mémoire. Les récompenses renforcent les transitions utiles et façonnent la politique de l'agent." },
      { title: "Apprentissage", body: "Chaque expérience met à jour le réseau de clips. Les récompenses augmentent la probabilité de choisir à nouveau les actions qui ont mené au succès, tandis que les paramètres de décroissance affaiblissent progressivement les expériences anciennes." },
      { title: "Paramètres de mémoire", body: "L'amortissement de mémoire contrôle l'oubli, le couplage de récompense règle la force avec laquelle les récompenses modifient la mémoire, et la décroissance du glow détermine combien de temps les transitions récentes restent pertinentes pour des récompenses différées." },
      { title: "Pourquoi c'est utile", body: "Ces réglages déterminent si l'agent apprend des stratégies à court ou long terme, s'il s'adapte prudemment ou agressivement, et s'il peut résoudre des tâches avec des récompenses retardées." }
    ],
    levelLabel: "Niveau",
    levelInstructions: "Instructions du niveau",
    winCondition: "Condition de victoire",
    lockedParameters: "Paramètres verrouillés",
    howToPlay: "Comment jouer",
    howToPlayItems: [
      "Lance la simulation et observe l'exploration.",
      "Ajuste les curseurs disponibles.",
      "Utilise les flèches de mémoire et les courbes de récompense.",
      "Atteins l'objectif pendant 5 épisodes consécutifs.",
      "Termine un niveau pour débloquer le suivant."
    ],
    levelComplete: "Niveau terminé",
    advancingTo: "Passage au",
    nextLevelButton: "Aller au niveau suivant",
    congratulations: "Félicitations",
    rlMaster: "Tous les niveaux sont termines. Tu peux maintenant continuer en mode libre.",
    continueFreePlay: "Continuer en mode libre",
    freePlayMenu: "Mode libre",
    freePlayActive: "Le mode libre est actif. La campagne est finie mais la simulation reste ouverte.",
    run: "Lancer",
    pause: "Pause",
    resetLevel: "Réinitialiser le niveau",
    resetGame: "Réinitialiser le jeu",
    buildEnvironment: "Construis ton environnement",
    memoryTitle: "Mémoire de l'agent PS",
    learnMorePS: "En savoir plus sur la Projective Simulation",
    tuneAgent: "Règle l'agent pour qu'il apprenne",
    rewardsTitle: "Courbes d'apprentissage",
    tipsTitle: "Conseils d'apprentissage",
    tipsButton: "Ouvrir les conseils",
    tipsModalTitle: "Conseils et guide des paramètres",
    tipsLead: "Aide-mémoire rapide pour guider l'agent.",
    strugglingTitle: "Besoin d'un indice ?",
    optimalParamsTitle: "Bonnes plages de paramètres",
    optimalParamsLead: "Ces plages sont de très bons points de départ pour la plupart des niveaux.",
    level: "Niveau",
    preset: "Préréglage",
    keyStatus: "État de la clé",
    keyStatusCollected: "Clés récupérées",
    keyStatusAvailable: "Clés sur la grille",
    keyStatusUnused: "Aucune clé sur cette grille",
    keyStatusMissing: "Une porte est présente mais la clé correspondante manque",
    addChallenges: "Ajouter des défis",
    width: "Largeur",
    height: "Hauteur",
    apply: "Appliquer",
    stepsPerSecond: "Pas/sec",
    stepCost: "Coût par pas",
    goalReward: "Récompense objectif",
    trapPenalty: "Pénalité lave",
    envSliderHelp: {
      speed: "Vitesse de la simulation. Des valeurs plus élevées exécutent plus d'épisodes par seconde.",
      stepCost: "Pénalité appliquée à chaque pas. Des valeurs négatives encouragent l'agent à trouver des chemins plus courts vers l'objectif.",
      goalReward: "Récompense positive reçue lorsque l'agent atteint l'objectif. Des valeurs plus élevées rendent l'objectif plus attractif.",
      trapPenalty: "Récompense négative lorsque l'agent entre dans la lave. Des valeurs plus négatives l'amènent à l'éviter plus fortement."
    },
    paramLabels: {
      psGamma: "Amortissement de mémoire (γ)",
      psLambda: "Couplage de récompense (λ)",
      psGlowEta: "Décroissance du glow (η)",
    },
    paramHelp: {
      psGamma: (
        <ul className="pl-4 space-y-1">
          <p>À quelle vitesse l'agent oublie les connexions entre les expériences passées :</p><strong>
          <li>Valeurs plus basses = mémoire plus longue</li>
          <li>Valeurs plus élevées = oubli plus rapide</li></strong>
        </ul>
      ),
      psLambda: (
        <ul className="pl-4 space-y-1">
          <p>Mesure à quel point les récompenses influencent l'apprentissage :</p>
          <li><strong> Valeurs plus élevées = mises à jour plus importantes.</strong></li>
        </ul>
      ),
      psGlowEta: (
        <ul className="pl-4 space-y-1">
          <p>Contrôle la vitesse à laquelle les activations temporaires s'effacent. Cela permet à l'agent d'apprendre même avec des récompenses rares :</p>
          <strong>
          <li>Valeurs plus élevées = mémoire courte des actions passées</li>
          <li>Valeurs plus faibles = davantage d'actions passées restent prises en compte</li>
          </strong>
        </ul>
      ),
    },
    rewardCharts: {
      instant: "Récompense instantanée (R)",
      cumulative: "Récompense cumulative (C)",
      episode: "Retour par épisode (G)",
      instantHelp: "Montre les récompenses reçues à chaque pas de temps pendant l'apprentissage.",
      cumulativeHelp: "Récompense totale accumulée sur l'ensemble des pas de temps - mesure la progression globale de l'apprentissage.",
      episodeHelp: "Récompense totale accumulée dans chaque épisode - une tendance à la hausse montre que l'agent apprend de meilleures politiques."
    },
    stats: {
      episode: "Épisode",
      currentReturn: "G actuel",
      totalReturn: "Retour total"
    },
    presetLabels: {
      open: "Champ ouvert",
      corridor: "Couloir",
      "two-rooms": "Deux salles",
      maze: "Labyrinthe"
    },
    keyColors: {
      blue: "Bleue",
      red: "Rouge",
      green: "Verte"
    },
    keyBrushLabel: "Clé",
    doorBrushLabel: "Porte",
    openDoorBrushLabel: "Porte ouverte",
    cellLabels: {
      wall: "Mur",
      empty: "Vide",
      goal: "Objectif",
      trap: "Lave",
      start: "Départ"
    }
  },
  es: {
    appTitle: "Laboratorio interactivo de Reinforcement Learning",
    appSubtitle: "¡Ven a entrenar tu agente de reinforcement learning en tiempo real!",
    language: "Idioma",
    generalConcepts: "Conceptos generales",
    generalSections: [
      { title: "Reinforcement Learning (RL)", body: "Un paradigma de aprendizaje automático en el que un agente aprende interactuando con un entorno, recibiendo recompensas por sus acciones y tratando de maximizar la recompensa acumulada a lo largo del tiempo." },
      { title: "Projective Simulation (PS)", body: "Un algoritmo de aprendizaje que modela la toma de decisiones como un paseo aleatorio sobre un grafo. Las experiencias del agente se almacenan en clips y las transiciones recompensadas se vuelven más fuertes." },
      { title: "Entorno", body: "Entrenamos a un agente PS en un mundo de cuadrícula donde debe llegar a la meta de forma eficiente evitando peligros. Según el nivel, la cuadrícula puede incluir muros, trap, llaves y puertas." },
      { title: "Visualización de la política", body: "El panel de memoria muestra la política aprendida en forma de flechas. Las flechas más brillantes representan acciones que el agente elegirá con mayor probabilidad." }
    ],
    psModalTitle: "Projective Simulation (PS)",
    psSections: [
      { title: "Resumen", body: "Projective Simulation modela la toma de decisiones como un paseo aleatorio sobre una red de clips que representan percepciones, acciones y fragmentos cortos de memoria. Las recompensas refuerzan transiciones útiles y moldean la política del agente." },
      { title: "Cómo aprende", body: "Cada experiencia actualiza la red de clips. Las recompensas aumentan la probabilidad de repetir acciones que antes condujeron al éxito, mientras que los parámetros de decaimiento hacen que las experiencias antiguas pierdan peso." },
      { title: "Parámetros de memoria", body: "La amortiguación de memoria controla cuánto olvida el agente, el acoplamiento de recompensa regula cuánto cambia la memoria con la recompensa, y el decaimiento del glow determina cuánto tiempo siguen recibiendo crédito las transiciones recientes." },
      { title: "Por qué importa", body: "Estos ajustes determinan si el agente aprende estrategias a corto o largo plazo, si se adapta de forma prudente o agresiva y si puede resolver tareas con recompensas retardadas." }
    ],
    levelLabel: "Nivel",
    levelInstructions: "Instrucciones del nivel",
    winCondition: "Condición de victoria",
    lockedParameters: "Parámetros bloqueados",
    howToPlay: "Cómo jugar",
    howToPlayItems: [
      "Inicia la simulación y observa la exploración.",
      "Ajusta los controles disponibles.",
      "Usa las flechas de memoria y las curvas de recompensa para medir el progreso.",
      "Alcanza el objetivo durante 5 episodios seguidos.",
      "Completa un nivel para desbloquear el siguiente."
    ],
    levelComplete: "Nivel completado",
    advancingTo: "Avanzando a",
    nextLevelButton: "Ir al siguiente nivel",
    congratulations: "Felicidades",
    rlMaster: "Has completado todos los niveles. Ahora puedes seguir en modo libre.",
    continueFreePlay: "Continuar en modo libre",
    freePlayMenu: "Modo libre",
    freePlayActive: "El modo libre está activo. La campaña terminó, pero la simulación sigue disponible.",
    run: "Iniciar",
    pause: "Pausa",
    resetLevel: "Reiniciar nivel",
    resetGame: "Reiniciar juego",
    buildEnvironment: "Construye tu entorno",
    memoryTitle: "Memoria del agente PS",
    learnMorePS: "Aprende más sobre Projective Simulation",
    tuneAgent: "Ajusta el agente para que aprenda",
    rewardsTitle: "Curvas de aprendizaje",
    tipsTitle: "Consejos de aprendizaje",
    tipsButton: "Abrir consejos",
    tipsModalTitle: "Consejos y guía de parámetros",
    tipsLead: "Chuleta rápida para ayudar al agente.",
    strugglingTitle: "¿Necesitas una pista?",
    optimalParamsTitle: "Buenos rangos de parámetros",
    optimalParamsLead: "Estos rangos son buenos puntos de partida prácticos para la mayoría de los niveles.",
    level: "Nivel",
    preset: "Preajuste",
    keyStatus: "Estado de la llave",
    keyStatusCollected: "Llaves recogidas",
    keyStatusAvailable: "Llaves en la cuadrícula",
    keyStatusUnused: "No hay llaves en esta cuadrícula",
    keyStatusMissing: "Hay una puerta pero falta su llave correspondiente",
    addChallenges: "Añadir nuevos retos",
    width: "Ancho",
    height: "Alto",
    apply: "Aplicar",
    stepsPerSecond: "Pasos/seg",
    stepCost: "Costo por paso",
    goalReward: "Recompensa meta",
    trapPenalty: "Penalización trap",
    envSliderHelp: {
      speed: "Velocidad de la simulación. Los valores más altos ejecutan más episodios por segundo.",
      stepCost: "Penalización por cada paso. Los valores negativos animan al agente a encontrar caminos más cortos hacia la meta.",
      goalReward: "Recompensa positiva al alcanzar la meta. Los valores más altos hacen que la meta resulte más atractiva.",
      trapPenalty: "Recompensa negativa por entrar en la trap. Valores más negativos hacen que el agente la evite con más fuerza."
    },
    paramLabels: {
      psGamma: "Amortiguación de memoria (γ)",
      psLambda: "Acoplamiento de recompensa (λ)",
      psGlowEta: "Decaimiento del glow (η)",
    },
    paramHelp: {
      psGamma: (
        <ul className="pl-4 space-y-1">
          <p>Qué tan rápido el agente olvida las conexiones entre experiencias pasadas:</p><strong>
          <li>Valores más bajos = memoria más larga</li>
          <li>Valores más altos = olvido más rápido</li></strong>
        </ul>
      ),
      psLambda: (
        <ul className="pl-4 space-y-1">
          <p>Escala cuánto influyen las recompensas en el aprendizaje:</p>
          <li><strong> Valores más altos = actualizaciones más grandes.</strong></li>
        </ul>
      ),
      psGlowEta: (
        <ul className="pl-4 space-y-1">
          <p>Controla qué tan rápido se desvanecen los patrones de activación temporales. Esto permite que el agente aprenda incluso con recompensas escasas:</p>
          <strong>
          <li>Valores más altos = memoria corta de acciones pasadas</li>
          <li>Valores más bajos = se conservan más acciones anteriores</li>
          </strong>
        </ul>
      ),
    },
    rewardCharts: {
      instant: "Recompensa instantánea (R)",
      cumulative: "Recompensa acumulada (C)",
      episode: "Retorno por episodio (G)",
      instantHelp: "Muestra las recompensas recibidas en cada paso temporal durante el aprendizaje.",
      cumulativeHelp: "Recompensa total acumulada a lo largo de todos los pasos temporales - mide el progreso general del aprendizaje.",
      episodeHelp: "Recompensa total acumulada en cada episodio - las tendencias ascendentes muestran que el agente está aprendiendo mejores políticas."
    },
    stats: {
      episode: "Episodio",
      currentReturn: "G actual",
      totalReturn: "Retorno total"
    },
    presetLabels: {
      open: "Campo abierto",
      corridor: "Pasillo",
      "two-rooms": "Dos salas",
      maze: "Laberinto"
    },
    keyColors: {
      blue: "Azul",
      red: "Roja",
      green: "Verde"
    },
    keyBrushLabel: "Llave",
    doorBrushLabel: "Puerta",
    openDoorBrushLabel: "Puerta abierta",
    cellLabels: {
      wall: "Muro",
      empty: "Vacío",
      goal: "Meta",
      trap: "Falle",
      start: "Inicio"
    }
  }
};

type PointTR = { t: number; R: number };
type PointTC = { t: number; C: number };
type PointEG = { ep: number; G: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function cloneGrid(grid: CellType[][]): CellType[][] {
  return grid.map((row) => [...row]);
}

function gridHasCell(grid: CellType[][], cell: CellType): boolean {
  return grid.some((row) => row.includes(cell));
}

function gridSome(grid: CellType[][], predicate: (cell: CellType) => boolean): boolean {
  return grid.some((row) => row.some(predicate));
}

function isKeyCell(cell: CellType): cell is KeyCell {
  return cell.startsWith("key-");
}

function isClosedDoorCell(cell: CellType): cell is DoorClosedCell {
  return cell.startsWith("door-") && cell.endsWith("-closed");
}

function isOpenDoorCell(cell: CellType): cell is DoorOpenCell {
  return cell.startsWith("door-") && cell.endsWith("-open");
}

function isDoorCell(cell: CellType): cell is DoorCell {
  return isClosedDoorCell(cell) || isOpenDoorCell(cell);
}

function getKeyIdFromCell(cell: CellType): KeyId | null {
  if (isKeyCell(cell)) {
    return cell.replace("key-", "") as KeyId;
  }
  if (isDoorCell(cell)) {
    return cell.split("-")[1] as KeyId;
  }
  return null;
}

function makeKeyCell(keyId: KeyId): KeyCell {
  return `key-${keyId}`;
}

function makeClosedDoorCell(keyId: KeyId): DoorClosedCell {
  return `door-${keyId}-closed`;
}

function makeOpenDoorCell(keyId: KeyId): DoorOpenCell {
  return `door-${keyId}-open`;
}

function stripDoorMechanics(grid: CellType[][]): CellType[][] {
  return grid.map((row) =>
    row.map((cell) => (isKeyCell(cell) || isDoorCell(cell) ? "empty" : cell)),
  );
}

function findStartPosition(grid: CellType[][]): { x: number; y: number } {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < (grid[0]?.length ?? 0); x++) {
      if (grid[y][x] === "start") {
        return { x, y };
      }
    }
  }
  return { x: 0, y: Math.max(0, grid.length - 1) };
}

function findCellPosition(grid: CellType[][], predicate: (cell: CellType) => boolean): { x: number; y: number } | null {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < (grid[y]?.length ?? 0); x++) if (predicate(grid[y][x])) return { x, y };
  }
  return null;
}

function reachableWithoutDoor(grid: CellType[][], start: { x: number; y: number }, target: { x: number; y: number }): boolean {
  const queue = [start];
  const seen = new Set([`${start.x},${start.y}`]);
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index];
    if (point.x === target.x && point.y === target.y) return true;
    for (const action of ACTIONS) {
      const next = stepXY(point.x, point.y, action);
      const cell = grid[next.y]?.[next.x];
      const id = `${next.x},${next.y}`;
      if (!cell || cell === "wall" || isDoorCell(cell) || cell === "trap" || seen.has(id)) continue;
      seen.add(id);
      queue.push(next);
    }
  }
  return false;
}

function getLevelText(level: LevelConfig | undefined, language: Locale) {
  if (!level) {
    return { name: "", description: "", instructions: "" };
  }
  return LAB_STORY_TEXT[language].cases[level.id - 1] ?? level;
}

function getMiscText(language: Locale) {
  switch (language) {
    case "de":
      return {
        infoButtonTitle: "Allgemeine Informationen anzeigen",
        instructionsButtonTitle: "Fall-Hinweise anzeigen",
        fixedAt: "Festgelegt auf",
        memoryEquationsTitle: "Speicher-Update-Gleichungen",
        memoryEquationsLead: "Diese Gleichungen zeigen, wie h-Werte und Glow-Spuren nach jedem Schritt aktualisiert werden.",
        glowLead: "Glow-Werte markieren kürzlich genutzte Übergänge, damit verzögerte Belohnungen frühere Aktionen noch verstärken können.",
        glowRecent: "Wenn ein Übergang gerade genutzt wurde, wird sein Glow auf 1 gesetzt.",
        gridSizeLabel: "Gittergröße",
        gridSizeHelp: "Steuert die Darstellungsgröße des Speicher-/Policy-Inspektor-Gitters. Größer = detailliertere Ansicht der gelernten Politik.",
        xTimeStep: "Zeitschritt",
        yReward: "Belohnung",
        yCumulativeReward: "Kumulative Belohnung",
        xEpisodeNumber: "Episodennummer",
        yReturn: "Return",
        noGridData: "Keine Gitterdaten verfügbar",
        gridUnavailable: "Gitterdaten konnten nicht geladen werden",
        psCell: "PS-Zelle",
        glowMax: "Glow-Maximum",
        inspectorError: "Die Speicheransicht hatte einen Fehler. Versuche, das Level zurückzusetzen.",
        retry: "Erneut versuchen",
      };
    case "it":
      return {
        infoButtonTitle: "Mostra le informazioni generali",
        instructionsButtonTitle: "Mostra le istruzioni del livello",
        fixedAt: "Fissato a",
        memoryEquationsTitle: "Equazioni di aggiornamento della memoria",
        memoryEquationsLead: "Queste equazioni mostrano come vengono aggiornati i valori h e le tracce glow dopo ogni passo.",
        glowLead: "I valori glow evidenziano le transizioni recenti, così anche le ricompense ritardate possono rinforzare le azioni precedenti.",
        glowRecent: "Se una transizione è appena stata eseguita, il suo glow viene impostato a 1.",
        gridSizeLabel: "Dimensione griglia",
        gridSizeHelp: "Controlla la dimensione di visualizzazione della griglia dell'ispettore di memoria/policy. Più grande = vista più dettagliata della policy appresa.",
        xTimeStep: "Passo temporale",
        yReward: "Ricompensa",
        yCumulativeReward: "Ricompensa cumulativa",
        xEpisodeNumber: "Numero episodio",
        yReturn: "Ritorno",
        noGridData: "Nessun dato della griglia disponibile",
        gridUnavailable: "Impossibile caricare i dati della griglia",
        psCell: "Cella PS",
        glowMax: "Glow massimo",
        inspectorError: "La visualizzazione della memoria ha avuto un errore. Prova a reimpostare il livello.",
        retry: "Riprova",
      };
    case "fr":
      return {
        infoButtonTitle: "Afficher les informations générales",
        instructionsButtonTitle: "Afficher les instructions du niveau",
        fixedAt: "Fixé à",
        memoryEquationsTitle: "Équations de mise à jour de la mémoire",
        memoryEquationsLead: "Ces équations montrent comment les valeurs h et les traces glow sont mises à jour après chaque pas.",
        glowLead: "Les valeurs de glow marquent les transitions récentes afin que des récompenses tardives puissent encore renforcer les actions passées.",
        glowRecent: "Si une transition vient juste d'être empruntée, son glow est fixé à 1.",
        gridSizeLabel: "Taille de la grille",
        gridSizeHelp: "Contrôle la taille d'affichage de la grille de l'inspecteur mémoire/politique. Plus grand = vue plus détaillée de la politique apprise.",
        xTimeStep: "Pas de temps",
        yReward: "Récompense",
        yCumulativeReward: "Récompense cumulative",
        xEpisodeNumber: "Numéro d'épisode",
        yReturn: "Retour",
        noGridData: "Aucune donnée de grille disponible",
        gridUnavailable: "Impossible de charger les données de la grille",
        psCell: "Cellule PS",
        glowMax: "Glow max",
        inspectorError: "La visualisation de la mémoire a rencontré une erreur. Essaie de réinitialiser le niveau.",
        retry: "Réessayer",
      };
    case "es":
      return {
        infoButtonTitle: "Ver información general",
        instructionsButtonTitle: "Ver instrucciones del nivel",
        fixedAt: "Fijado en",
        memoryEquationsTitle: "Ecuaciones de actualización de memoria",
        memoryEquationsLead: "Estas ecuaciones muestran cómo se actualizan los valores h y las trazas glow después de cada paso.",
        glowLead: "Los valores de glow marcan transiciones recientes para que recompensas tardías aún puedan reforzar acciones anteriores.",
        glowRecent: "Si una transición acaba de ocurrir, su glow se fija en 1.",
        gridSizeLabel: "Tamaño de la cuadrícula",
        gridSizeHelp: "Controla el tamaño de visualización de la cuadrícula del inspector de memoria/política. Más grande = vista más detallada de la política aprendida.",
        xTimeStep: "Paso temporal",
        yReward: "Recompensa",
        yCumulativeReward: "Recompensa acumulada",
        xEpisodeNumber: "Número de episodio",
        yReturn: "Retorno",
        noGridData: "No hay datos de cuadrícula disponibles",
        gridUnavailable: "No se pudieron cargar los datos de la cuadrícula",
        psCell: "Celda PS",
        glowMax: "Glow máximo",
        inspectorError: "La visualización de memoria encontró un error. Intenta reiniciar el nivel.",
        retry: "Reintentar",
      };
    default:
      return {
        infoButtonTitle: "View general information",
        instructionsButtonTitle: "View case instructions",
        fixedAt: "Fixed at",
        memoryEquationsTitle: "Memory Update Equations",
        memoryEquationsLead: "The strength of the connections between memories (clips) is stored in an h-value. For a transition from clip i to clip j, the strength is updated as follows upon receiving a reward R:",
        glowLead: 'Glow values (g) represents the memory of the past transitions: the more recent a transition was experienced, the higher the glow value. Intuitively, glow is illuminating the path the agent took, and this "light" fades over time at a rate the depends on η. In Reinforcement Learning, glow can also be related to a so-called eligibility trace: it flags transitions that might have contributed to a certain reward value, allowing the agent to assign credit to not only the most recent action, but also to a sequence of past actions that led to the reward. The glow values are updated as follows:',
        glowRecent: "and if the transition from clip i to clip j was just experienced, then glow is set to 1:",
        gridSizeLabel: "Size of the grid",
        gridSizeHelp: "Controls the visualization size of the memory/policy inspector grid. Larger = more detailed view of the learned policy.",
        xTimeStep: "Time Step",
        yReward: "Reward",
        yCumulativeReward: "Cumulative Reward",
        xEpisodeNumber: "Episode Number",
        yReturn: "Return",
        noGridData: "No grid data available",
        gridUnavailable: "Unable to load grid data",
        psCell: "PS cell",
        glowMax: "glow max",
        inspectorError: "The memory visualization encountered an error. Try resetting the level.",
        retry: "Retry",
      };
  }
}

const LAB_FEATURE_TEXT: Record<Locale, {
  percepts: string; actions: string; rewardSummary: string; currentEpisode: string;
  stepPenalties: string; watchReward: string; keyReward: string; doorReward: string;
  instantReward: string; shortestPath: string; keyObjective: string; doorObjective: string;
  watchObjective: string; objectiveMark: string; chartsHint: string; visitFrequencies: string;
  construction: string; constructionHint: string; yourObjectives: string; positionAxis: string; frequencyAxis: string;
}> = {
  en: {
    percepts: "Percepts", actions: "Actions", rewardSummary: "Rewards in this environment", currentEpisode: "Current episode",
    stepPenalties: "Accumulated step penalty", watchReward: "Watch reward", keyReward: "Key reward", doorReward: "Door reward",
    instantReward: "Instantaneous reward", shortestPath: "Shortest-path probability", keyObjective: "Get the key",
    doorObjective: "Open the door", watchObjective: "Reach the watch quickly from the door", objectiveMark: "75% objective",
    chartsHint: "Select a title to open its graph.", visitFrequencies: "Normalized location visits", construction: "Environment under construction",
    constructionHint: "Close Environment settings when the room is ready. Nova cannot move while construction is open.",
    yourObjectives: "Your objectives", positionAxis: "Position", frequencyAxis: "Frequency",
  },
  de: {
    percepts: "Perzepte", actions: "Aktionen", rewardSummary: "Belohnungen in dieser Umgebung", currentEpisode: "Aktuelle Episode",
    stepPenalties: "Kumulierte Schrittstrafe", watchReward: "Uhr-Belohnung", keyReward: "Schlüssel-Belohnung", doorReward: "Tür-Belohnung",
    instantReward: "Momentane Belohnung", shortestPath: "Kürzeste-Wege-Wahrscheinlichkeit", keyObjective: "Schlüssel holen",
    doorObjective: "Tür öffnen", watchObjective: "Von der Tür schnell zur Uhr", objectiveMark: "75-%-Ziel",
    chartsHint: "Wähle einen Titel, um das Diagramm zu öffnen.", visitFrequencies: "Normalisierte Ortsbesuche", construction: "Umgebung im Bau",
    constructionHint: "Schließe die Umgebungseinstellungen, wenn der Raum fertig ist. Während des Bauens kann Nova sich nicht bewegen.",
    yourObjectives: "Deine Ziele", positionAxis: "Position", frequencyAxis: "Häufigkeit",
  },
  it: {
    percepts: "Percezioni", actions: "Azioni", rewardSummary: "Ricompense in questo ambiente", currentEpisode: "Episodio corrente",
    stepPenalties: "Penalità di passo accumulata", watchReward: "Ricompensa orologio", keyReward: "Ricompensa chiave", doorReward: "Ricompensa porta",
    instantReward: "Ricompensa istantanea", shortestPath: "Probabilità del percorso più breve", keyObjective: "Prendere la chiave",
    doorObjective: "Aprire la porta", watchObjective: "Raggiungere rapidamente l'orologio dalla porta", objectiveMark: "Obiettivo 75%",
    chartsHint: "Seleziona un titolo per aprire il grafico.", visitFrequencies: "Visite normalizzate delle posizioni", construction: "Ambiente in costruzione",
    constructionHint: "Chiudi le impostazioni dell'ambiente quando la stanza è pronta. Nova non può muoversi durante la costruzione.",
    yourObjectives: "I tuoi obiettivi", positionAxis: "Posizione", frequencyAxis: "Frequenza",
  },
  fr: {
    percepts: "Percepts", actions: "Actions", rewardSummary: "Récompenses dans cet environnement", currentEpisode: "Épisode en cours",
    stepPenalties: "Pénalité de pas cumulée", watchReward: "Récompense de la montre", keyReward: "Récompense de la clé", doorReward: "Récompense de la porte",
    instantReward: "Récompense instantanée", shortestPath: "Probabilité du chemin le plus court", keyObjective: "Obtenir la clé",
    doorObjective: "Ouvrir la porte", watchObjective: "Atteindre vite la montre depuis la porte", objectiveMark: "Objectif 75 %",
    chartsHint: "Sélectionnez un titre pour ouvrir son graphique.", visitFrequencies: "Visites normalisées des positions", construction: "Environnement en construction",
    constructionHint: "Fermez les paramètres de l'environnement lorsque la salle est prête. Nova ne peut pas bouger pendant la construction.",
    yourObjectives: "Vos objectifs", positionAxis: "Position", frequencyAxis: "Fréquence",
  },
  es: {
    percepts: "Percepciones", actions: "Acciones", rewardSummary: "Recompensas en este entorno", currentEpisode: "Episodio actual",
    stepPenalties: "Penalización acumulada por pasos", watchReward: "Recompensa del reloj", keyReward: "Recompensa de la llave", doorReward: "Recompensa de la puerta",
    instantReward: "Recompensa instantánea", shortestPath: "Probabilidad del camino más corto", keyObjective: "Conseguir la llave",
    doorObjective: "Abrir la puerta", watchObjective: "Llegar rápido al reloj desde la puerta", objectiveMark: "Objetivo 75 %",
    chartsHint: "Selecciona un título para abrir su gráfica.", visitFrequencies: "Visitas normalizadas de ubicaciones", construction: "Entorno en construcción",
    constructionHint: "Cierra los ajustes del entorno cuando la sala esté lista. Nova no puede moverse durante la construcción.",
    yourObjectives: "Tus objetivos", positionAxis: "Posición", frequencyAxis: "Frecuencia",
  },
};

function makeGrid(w: number, h: number, preset: string): CellType[][] {
  const grid: CellType[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => "empty" as CellType));
  if (preset === "open") {
    grid[0][w - 1] = "goal";
    grid[h - 1][0] = "start";
    // grid[h - 1][w - 2] = "trap";
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
    grid[doorY][mid] = makeClosedDoorCell("blue");
    grid[h - 1][0] = "start";
    grid[0][0] = makeKeyCell("blue");
    grid[0][w - 2] = "goal";
  } else if (preset === "maze") {
    // for (let y = 1; y < h - 1; y += 2) {
    //   for (let x = 1; x < w - 1; x++) grid[y][x] = "wall";
    //   const gap = 1 + ((y * 3) % (w - 2));
    //   grid[y][gap] = "empty";
    // }
    // grid[h-1][1] = "trap";
    // grid[0][w-2] = "trap";
    // grid[h - 1][0] = "start";
    // grid[0][w - 1] = "goal";
    const doorY = Math.floor(h / 2);
    const mid = Math.floor(w / 2);
    for (let y = 0; y < h; y++) {
      if (y === doorY) continue;
      grid[y][mid] = "wall";
    }
    grid[doorY][mid] = makeClosedDoorCell("blue");
    grid[h - 1][0] = "start";
    // A through-route avoids contradictory choices at a revisited key dead end.
    grid[0][1] = makeKeyCell("blue");
    grid[1][0] = "wall";
    grid[doorY-1][mid+1]="trap";
    grid[0][w - 2] = "goal";
  }
  return grid;
}

function makeLevelMemory(grid: CellType[][], percepts: LabPercepts, level: number): PSLayer {
  const memory = makeLabMemory(grid, percepts);
  if (level === 2) {
    grid.forEach((row, y) => row.forEach((cell, x) => {
      if (cell === "wall") return;
      const color = percepts.colors[y][x];
      if (color === LAB_COLORS[1]) memory.hvals[memory.idx(x, y, 0)] = 1.12;
      if (color === LAB_COLORS[2]) memory.hvals[memory.idx(x, y, 1)] = 1.12;
      if (color === LAB_COLORS[4]) memory.hvals[memory.idx(x, y, 0)] = 1.06;
    }));
  }
  if (level === 3) {
    const doorX = Math.floor(grid[0].length / 2);
    const doorY = Math.floor(grid.length / 2);
    grid.forEach((row, y) => row.forEach((cell, x) => {
      if (cell === "wall") return;
      // Before collecting the key, favor the upper-left corner.
      if (x < doorX) memory.hvals[memory.idx(x, y, y > 0 ? 0 : 3, 0)] = 1.1;
      // With the key, favor the doorway and then the watch room.
      const action = x < doorX ? x < doorX - 1 ? 1 : y < doorY ? 2 : y > doorY ? 0 : 1
        : x < grid[0].length - 2 ? 1 : y > 0 ? 0 : 1;
      memory.hvals[memory.idx(x, y, action, 1)] = 1.15;
    }));
  }
  return memory;
}

function stepXY(x:number,y:number,a:Action){
  if(a==="up")return{x,y:y-1};
  if(a==="down")return{x,y:y+1};
  if(a==="left")return{x:x-1,y};
  if(a==="right")return{x:x+1,y};
  return{x:x+1,y};
}

function HelpTooltipButton({ help, title, disabled }: { help: React.ReactNode; title?: string; disabled?: boolean }) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; placeAbove: boolean } | null>(null);

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 16);
      const halfWidth = width / 2;
      const left = Math.min(Math.max(rect.left + rect.width / 2, halfWidth + 8), window.innerWidth - halfWidth - 8);
      const placeAbove = rect.top > 140;
      setPosition({
        top: placeAbove ? rect.top - 8 : rect.bottom + 8,
        left,
        width,
        placeAbove,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  return (
    <>
      <span
        ref={anchorRef}
        className="inline-flex"
        onMouseEnter={() => !disabled && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => !disabled && setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Button
          style={{ backgroundColor: "transparent", borderColor: "transparent" }}
          className="border-0 outline-none ring-0 focus-visible:ring-0 focus-visible:outline-none focus-visible:ring-offset-0 p-0 h-4 w-4"
          variant="ghost"
          disabled={disabled}
          title={title}
        >
          <HelpCircle className="size-4 text-indigo-900" />
        </Button>
      </span>
      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[120] rounded border border-blue-200 bg-blue-50 p-2 text-left text-xs text-slate-700 shadow-lg pointer-events-none"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                transform: `translate(-50%, ${position.placeAbove ? "-100%" : "0"})`,
              }}
            >
              {help}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function SliderWithVal({ label, min, max, step=1, value, onChange, help, disabled, scale = "linear", locale = "en" }: { label: string, min: number, max: number, step?: number, value: number, onChange: (v:number)=>void, help?: React.ReactNode, disabled?: boolean, scale?: "linear" | "log", locale?: Locale }){
  const logarithmic = scale === "log";
  const numberFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 6, maximumSignificantDigits: 4 });
  const displayValue = numberFormatter.format(value);
  const marks = logarithmic ? LOG_PARAMETER_MARKS.map(({ value: mark }) => ({ value: mark, position: parameterToSlider(mark) / LOG_SLIDER_MAX * 100 })) : Array.from({ length: 5 }, (_, index) => {
    const mark = index === 0 ? min : index === 4 ? max : clamp(Math.round((min + (max - min) * index / 4) / step) * step, min, max);
    return { value: mark, position: (mark - min) / (max - min) * 100 };
  });
  return (
    <div className={`${disabled ? "opacity-50" : ""} min-w-0`}>
      <div className="mb-1 flex items-start justify-between gap-2 min-w-0">
        <div className="flex min-w-0 flex-1 items-start gap-1">
          <Label className={`${!disabled ? "!text-slate-700" : "!text-slate-400"} break-words leading-tight`}>{label}</Label>
          {help && (
            <HelpTooltipButton help={help} title={typeof help === "string" ? help : undefined} disabled={disabled} />
          )}
        </div>
        <span className={`shrink-0 text-xs ${!disabled ? "!text-slate-700" : "!text-slate-400"}`}>{displayValue}</span>
      </div>
      <Slider
        min={logarithmic ? 0 : min}
        max={logarithmic ? LOG_SLIDER_MAX : max}
        step={logarithmic ? 1 : step}
        value={[logarithmic ? parameterToSlider(value) : value]}
        aria-label={label}
        aria-valuetext={displayValue}
        onValueChange={(v: number[]) => {
          const raw = v[0];
          const next = logarithmic ? sliderToParameter(raw) : Number.isFinite(raw) ? clamp(raw, min, max) : min;
          onChange(next);
        }}
        disabled={disabled}
      />
      <div className={`parameter-slider-marks ${logarithmic ? "log-slider-marks" : ""}`} aria-hidden="true">{marks.map((mark) => <span key={mark.value} style={{ left: `${mark.position}%` }}>{numberFormatter.format(mark.value)}</span>)}</div>
    </div>
  );
}

function LabDecisionReadout({ decision, agent, grid, percepts, text }: { decision: LabDecision | null; agent: { x: number; y: number }; grid: CellType[][]; percepts: LabPercepts; text: typeof LAB_STORY_TEXT.en }) {
  const percept = decision?.percept ?? agent;
  const colors = ["#256d55", "#376bb5", "#d2764e", "#7357a6"];
  return <aside className="lab-decision-readout" aria-live="polite">
    <strong title={text.decisionHint}>{text.currentPercept}</strong>
    <div className="lab-percept-preview" style={{ background: percepts.useColors ? percepts.colors[percept.y]?.[percept.x] : "#fff" }} aria-hidden="true">{percepts.useObjects || grid[percept.y]?.[percept.x] === "goal" ? perceptObject(percepts, grid, percept.x, percept.y) : ""}</div>
    <span className="lab-percept-position">({percept.x + 1}, {percept.y + 1})</span>
    <strong>{text.currentAction}</strong>
    {decision ? <div className="lab-current-action" style={{ color: colors[decision.action] }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 22V3M6 9L12 3L18 9" transform={`rotate(${decision.action * 90} 12 12)`} fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /></svg><span>{text.actions[decision.action]}</span></div> : <small>{text.noAction}</small>}
  </aside>;
}

// Error Boundary for PSInspector
class PSInspectorErrorBoundary extends React.Component<
  { children: React.ReactNode; text: any },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; text: any }) {
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
          <div className="font-semibold mb-2">⚠️</div>
          <div className="text-xs">{this.props.text.inspectorError}</div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-2 py-1 bg-red-200 hover:bg-red-300 rounded text-xs"
          >
            {this.props.text.retry}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function PerceptGraph({ grid, percepts, ps, text, labels, view, greediness, seen }: {
  grid: CellType[][]; percepts: LabPercepts; ps: PSLayer; text: typeof LAB_STORY_TEXT.en;
  labels: (typeof LAB_FEATURE_TEXT)[Locale];
  view: MemoryView; greediness: number; seen: Set<string>;
}) {
  const nodes = new Map<string, { x: number; y: number; color: string }>();
  grid.forEach((row, y) => row.forEach((cell, x) => {
    if (cell === "wall") return;
    const id = perceptId(percepts, grid, x, y);
    if (seen.has(id) && !nodes.has(id)) nodes.set(id, { x, y, color: percepts.colors[y][x] });
  }));
  const entries = [...nodes.values()];
  const actionColors = ["#256d55", "#376bb5", "#d2764e", "#7357a6"];
  const values = entries.map(({ x, y }) => {
    const h = ACTIONS.map((_, action) => ps.getH(x, y, action));
    return view === "h" ? h : view === "glow" ? ACTIONS.map((_, action) => ps.getG(x, y, action)) : labPolicy(h, greediness);
  });
  const visualValues = values.flat().map((value) => view === "h" ? Math.max(0, value) : Math.abs(value));
  const maxValue = Math.max(1, ...visualValues);
  return <div className="lab-percept-graph" aria-label={text.memoryRepresentation}>
    <strong>{labels.percepts}</strong>
    <svg viewBox="0 0 360 250" role="img" aria-label={text.memoryShown.replace("{view}", view)}>
      {entries.map((_, index) => values[index].map((value, action) => {
        const visualValue = view === "h" ? Math.max(0, value) : Math.abs(value);
        const magnitude = view === "policy" ? value : visualValue / maxValue;
        return <line key={`${index}-${action}`} x1={(index + 1) * 360 / (entries.length + 1)} y1="48" x2={(action + 1) * 72} y2="205" stroke={actionColors[action]} strokeWidth={1 + 6 * magnitude} opacity={.18 + .82 * magnitude} />;
      }))}
      {entries.map((node, index) => <g key={`${node.x}-${node.y}`}>
        <circle cx={(index + 1) * 360 / (entries.length + 1)} cy="36" r="21" fill={node.color} stroke="#315b4c" strokeWidth="2" />
        <title>{node.color}</title>
      </g>)}
      {text.actions.map((action, index) => <g key={action}>
        <circle cx={(index + 1) * 72} cy="215" r="21" fill={actionColors[index]} />
        <text x={(index + 1) * 72} y="220" textAnchor="middle" fill="white" fontSize="17" fontWeight="bold">{["↑", "→", "↓", "←"][index]}</text>
      </g>)}
      <text x="180" y="248" textAnchor="middle" fill="#315342" fontSize="13" fontWeight="700">{labels.actions}</text>
    </svg>
  </div>;
}

function PSInspector({ grid, percepts, ps, text, view, agent, greediness, keyState = false, visitCounts, seenPercepts, compact = false, heatmap = false, showGlowHalo = true }: {
  grid: CellType[][];
  percepts: LabPercepts;
  ps: PSLayer;
  text: (typeof LAB_STORY_TEXT)["en"];
  view: MemoryView;
  agent: { x: number; y: number };
  greediness: number;
  keyState?: boolean;
  visitCounts?: number[][];
  seenPercepts?: Set<string>;
  compact?: boolean;
  heatmap?: boolean;
  showGlowHalo?: boolean;
}) {
  const memory = grid.map((row, y) => row.map((cell, x) => {
    const h = ACTIONS.map((_, action) => {
      const value = ps.getH(x, y, action, keyState ? 1 : 0);
      return Number.isFinite(value) ? value : 1;
    });
    const glow = ACTIONS.map((_, action) => {
      const value = ps.getG(x, y, action, keyState ? 1 : 0);
      return Number.isFinite(value) ? value : 0;
    });
    return { h, glow, probabilities: labPolicy(h, greediness), blocked: cell === "wall", known: !seenPercepts || seenPercepts.has(perceptId(percepts, grid, x, y)), percept: { color: percepts.colors[y][x], object: percepts.useObjects ? perceptObject(percepts, grid, x, y) : "" } };
  }));
  return (
    <div className="academy-memory-body">
      <MemoryGrid memory={memory} view={view} focus={agent} text={text} cellSize={compact ? 46 : 84} fitToPanel={!compact} showValues={!compact} emphasizeStrength colorActions={view === "policy"} showAgent showPercepts hideUnknown={Boolean(seenPercepts)} visitCounts={visitCounts} heatmap={heatmap} showGlowHalo={showGlowHalo} />
    </div>
  );
}

function ProgressCursor({ label, value, min, max, target, targetLabel, format = (number) => fmt(number) }: {
  label: string; value: number; min: number; max: number; target?: number; targetLabel?: string; format?: (value: number) => string;
}) {
  const span = max - min || 1;
  const position = clamp((value - min) / span * 100, 0, 100);
  const targetPosition = target === undefined ? null : clamp((target - min) / span * 100, 0, 100);
  return <div className="lab-progress-cursor">
    <div><strong>{label}</strong><b>{format(value)}</b></div>
    <div className="lab-cursor-track" aria-label={`${label}: ${format(value)}`}>
      <i className="lab-cursor-fill" style={{ width: `${position}%` }} />
      {targetPosition !== null && <span className="lab-cursor-target" style={{ left: `${targetPosition}%` }} title={targetLabel}><small>{targetLabel}</small></span>}
      <em style={{ left: `${position}%` }} />
    </div>
  </div>;
}

function VisitHistogram({ counts, grid, colors, gridW, label, positionAxis, frequencyAxis }: {
  counts: number[]; grid: CellType[][]; colors: string[][]; gridW: number; label: string; positionAxis: string; frequencyAxis: string;
}) {
  const maximum = Math.max(1, ...counts);
  // Give the plot substantially more vertical room than the old compact bars.
  // Each setting is normalized independently so small differences remain legible.
  const plot = { left: 42, right: 252, top: 9, bottom: 177 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const slotWidth = plotWidth / Math.max(1, counts.length);
  const barWidth = Math.max(2, slotWidth - 2);
  const markers = [0, 25, 50, 75, 100];
  return <div className="lab-visit-histogram">
    <small>{label}</small>
    <svg viewBox="0 0 260 225" role="img" aria-label={`${label}: ${frequencyAxis} by ${positionAxis}`}>
      {markers.map((marker) => {
        const y = plot.bottom - marker / 100 * plotHeight;
        return <g key={marker}>
          <line x1={plot.left} x2={plot.right} y1={y} y2={y} className="lab-histogram-gridline" />
          <text x={plot.left - 5} y={y + 3} textAnchor="end" className="lab-histogram-y-tick">{marker}%</text>
        </g>;
      })}
      {counts.map((count, index) => {
        const x = index % gridW;
        const y = Math.floor(index / gridW);
        const frequency = count / maximum;
        const wall = grid[y]?.[x] === "wall";
        const height = wall ? 2 : frequency * plotHeight;
        const barX = plot.left + index * slotWidth + (slotWidth - barWidth) / 2;
        return <g key={index}>
          <title>{`${positionAxis} ${index + 1} (${x + 1}, ${y + 1}): ${(frequency * 100).toFixed(1)}%`}</title>
          <rect className={wall ? "lab-histogram-bar wall" : "lab-histogram-bar"} x={barX} y={plot.bottom - height} width={barWidth} height={height} fill={wall ? "#8d9993" : colors[y]?.[x]} />
          <text x={barX + barWidth / 2} y={plot.bottom + 10} textAnchor="middle" className="lab-histogram-x-tick">{index + 1}</text>
        </g>;
      })}
      <line x1={plot.left} x2={plot.right} y1={plot.bottom} y2={plot.bottom} className="lab-histogram-axis" />
      <line x1={plot.left} x2={plot.left} y1={plot.top} y2={plot.bottom} className="lab-histogram-axis" />
      <text x={(plot.left + plot.right) / 2} y="216" textAnchor="middle" className="lab-histogram-axis-label">{positionAxis}</text>
      <text x="11" y={(plot.top + plot.bottom) / 2} textAnchor="middle" className="lab-histogram-axis-label" transform={`rotate(-90 11 ${(plot.top + plot.bottom) / 2})`}>{frequencyAxis}</text>
    </svg>
  </div>;
}

function BetaSelector({ value, onChange, text, histogramLabel, positionAxis, frequencyAxis, runs, visits, grid, colors, gridW, showHistograms = false }: {
  value: number; onChange: (value: number) => void; text: typeof LAB_STORY_TEXT.en;
  histogramLabel: string; positionAxis: string; frequencyAxis: string; runs?: Record<string, number>; visits?: Record<string, number[]>; grid: CellType[][]; colors: string[][]; gridW: number; showHistograms?: boolean;
}) {
  const labels = [text.explore, text.balanced, text.exploit];
  const empty = Array(grid.length * gridW).fill(0);
  return <div className="lab-exploration-controls">
    <strong>{text.temperatureLabel}</strong>
    <div className="lab-beta-scale-labels">{labels.map((label) => <span key={label}>{label}</span>)}</div>
    <input aria-label={text.temperatureLabel} type="range" min={0} max={2} step={1} value={Math.max(0, BETA_SETTINGS.indexOf(value as typeof BETA_SETTINGS[number]))} onChange={(event) => onChange(BETA_SETTINGS[Number(event.target.value)])} />
    <div className="lab-beta-marks">{BETA_SETTINGS.map((beta, index) => <button type="button" key={beta} aria-label={labels[index]} className={value === beta ? "selected" : ""} onClick={() => onChange(beta)}>
      <strong>{labels[index]}</strong>
      {runs && <small>{runs[String(beta)] ?? 0}/5 {text.trajectories}</small>}
      {showHistograms && <VisitHistogram counts={visits?.[String(beta)] ?? empty} grid={grid} colors={colors} gridW={gridW} label={histogramLabel} positionAxis={positionAxis} frequencyAxis={frequencyAxis} />}
    </button>)}</div>
  </div>;
}

function RewardSummary({ rewards, stepCost, goalReward, showKey, showDoor, labels }: {
  rewards: RewardBreakdown; stepCost: number; goalReward: number; showKey: boolean; showDoor: boolean; labels: (typeof LAB_FEATURE_TEXT)[Locale];
}) {
  return <section className="lab-reward-summary">
    <div><strong>{labels.rewardSummary}</strong><small>{labels.currentEpisode}</small></div>
    <ProgressCursor label={labels.stepPenalties} value={rewards.steps} min={Math.min(-1, stepCost * 50)} max={0} />
    <ProgressCursor label={labels.watchReward} value={rewards.watch} min={0} max={Math.max(1, goalReward)} />
    {showKey && <ProgressCursor label={labels.keyReward} value={rewards.key} min={0} max={1} />}
    {showDoor && <ProgressCursor label={labels.doorReward} value={rewards.door} min={0} max={1} />}
  </section>;
}

function RewardsPanel({ rewardTrace, cumTrace, episodeReturns, text, miscText }: { rewardTrace: PointTR[]; cumTrace: PointTC[]; episodeReturns: PointEG[]; text: any; miscText: any; }) {
  return (
    <Card className="academy-reward-charts">
      <CardContent className="space-y-2 sm:space-y-4 pt-6">
        <details className="academy-instant-reward mb-2 sm:mb-4">
          <summary className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-700 text-sm sm:text-base">{text.rewardCharts.instant}</h3>
            <HelpTooltipButton help={text.rewardCharts.instantHelp} title={text.rewardCharts.instantHelp} />
          </summary>
          <div className="academy-chart w-full overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rewardTrace} margin={{ top: 10, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" width={60}><ChartLabel value={miscText.xTimeStep} offset={-5} textAnchor="middle" dominantBaseline="central" position="bottom"/></XAxis>
                <YAxis dataKey="R" width={35} tickCount={3} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l)=>`t=${l}`}/>
                <Line type="monotone" dataKey="R" stroke="#376bb5" strokeWidth={2} dot={false} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </details>

        <details className="mb-2 sm:mb-4">
          <summary className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-700 text-sm sm:text-base">{text.rewardCharts.cumulative}</h3>
            <HelpTooltipButton help={text.rewardCharts.cumulativeHelp} title={text.rewardCharts.cumulativeHelp} />
          </summary>
          <div className="academy-chart w-full overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumTrace} margin={{ top: 10, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" width={60}><ChartLabel value={miscText.xTimeStep} offset={-5} textAnchor="middle" dominantBaseline="central" position="bottom"/></XAxis>
                <YAxis dataKey="C" width={35} tickCount={3} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l)=>`t=${l}`}/>
                <Area type="monotone" dataKey="C" stroke="#08734e" fill="#08734e" strokeWidth={2} fillOpacity={0.2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </details>
        <details>
          <summary className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-slate-700 text-sm sm:text-base">{text.rewardCharts.episode}</h3>
            <HelpTooltipButton help={text.rewardCharts.episodeHelp} title={text.rewardCharts.episodeHelp} />
          </summary>
          <div className="academy-chart w-full overflow-visible">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={episodeReturns} margin={{ top: 10, right: 0, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ep" width={60}><ChartLabel value={miscText.xEpisodeNumber} offset={-5} textAnchor="middle" dominantBaseline="central" position="bottom"/></XAxis>
                <YAxis dataKey="G" width={35} tickCount={3} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v:any)=>Number(v).toFixed(2)} labelFormatter={(l)=>`ep=${l}`}/>
                <Line type="monotone" dataKey="G" stroke="#7753a9" strokeWidth={2} dot={false} isAnimationActive={false}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

export default function InteractiveRLLab({
  language: controlledLanguage = "en",
  onLanguageChange,
  onHome,
}: {
  language?: AppLanguage;
  onLanguageChange?: (language: AppLanguage) => void;
  onHome?: () => void;
}){
  const [language, setInternalLanguage] = useState<Locale>(controlledLanguage);

  useEffect(() => {
    setInternalLanguage(controlledLanguage);
  }, [controlledLanguage]);

  function setLanguage(nextLanguage: AppLanguage) {
    setInternalLanguage(nextLanguage);
    onLanguageChange?.(nextLanguage);
  }
  const [currentLevel, setCurrentLevel] = useState(1);
  const [gridW,setGridW]=useState(LEVELS[0].gridW);
  const [gridH,setGridH]=useState(LEVELS[0].gridH);
  const [gridWInput, setGridWInput] = useState(String(LEVELS[0].gridW));
  const [gridHInput, setGridHInput] = useState(String(LEVELS[0].gridH));
  const [preset,setPreset]=useState(LEVELS[0].preset);
  const [grid,setGrid]=useState<CellType[][]>(()=>makeGrid(LEVELS[0].gridW, LEVELS[0].gridH, LEVELS[0].preset));
  const [percepts, setPercepts] = useState<LabPercepts>(() => makeLabPercepts(LEVELS[0].gridW, LEVELS[0].gridH, 1));
  //const [startPos,setStartPos]=useState<{x:number,y:number}>(()=>({x:0,y:5}));
  // start positions depend on gridH (use gridH - 1 safely)
  const [startPos, setStartPos] = useState<{ x: number; y: number }>(() => ({ x: 0, y: Math.max(0, gridH - 1) }));
  const [agent, setAgent] = useState<{ x: number; y: number }>(() => ({ x: 0, y: Math.max(0, gridH - 1) }));
  // const [agent,setAgent]=useState<{x:number,y:number}>({x:startPos.x,y:startPos.y});
  const [episode,setEpisode]=useState(1);
  const [running,setRunning]=useState(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>("click");
  const [episodeEnd, setEpisodeEnd] = useState<EpisodeEnd | null>(null);
  const [episodeHolding, setEpisodeHolding] = useState(false);
  const [lastDecision, setLastDecision] = useState<LabDecision | null>(null);
  const [stepCost,setStepCost]=useState(FINAL_LAB_PARAMETERS.stepCost);
  const [goalReward,setGoalReward]=useState(FINAL_LAB_PARAMETERS.goalReward);
  const [trapPenalty,setTrapPenalty]=useState(FINAL_LAB_PARAMETERS.trapPenalty);
  // const [wind,setWind]=useState(false);
  const [psLambda,setPsLambda]=useState(FINAL_LAB_PARAMETERS.psLambda);
  const [psGamma,setPsGamma]=useState(FINAL_LAB_PARAMETERS.psGamma);
  const [psGlowEta,setPsGlowEta]=useState(FINAL_LAB_PARAMETERS.psGlowEta);
  const [greediness,setGreediness]=useState(FINAL_LAB_PARAMETERS.greediness);
  const [rewardTrace,setRewardTrace]=useState<PointTR[]>([]);
  const [cumTrace,setCumTrace]=useState<PointTC[]>([]);
  const [episodeReturns,setEpisodeReturns]=useState<PointEG[]>([]);
  const [currentEpReturn,setCurrentEpReturn]=useState(0);
  const [pathAssessment, setPathAssessment] = useState<PathAssessment | null>(null);
  const [caseThreeAssessments, setCaseThreeAssessments] = useState<CaseThreeAssessments | null>(null);
  const [episodeRewards, setEpisodeRewards] = useState<RewardBreakdown>(EMPTY_REWARD_BREAKDOWN);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [showPsInfo, setShowPsInfo] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [gameWon, setGameWon] = useState(false);
  const [freePlayMode, setFreePlayMode] = useState(false);
  const [freePlayUnlocked, setFreePlayUnlocked] = useState(false);
  const [collectedKeys, setCollectedKeys] = useState<KeyId[]>([]);
  const [psVersion, setPsVersion] = useState(0);
  const [memoryView, setMemoryView] = useState<MemoryView>("h");
  const [seenPercepts, setSeenPercepts] = useState<Set<string>>(() => new Set([perceptId(percepts, grid, 0, gridH - 1)]));
  const [level2Stage, setLevel2Stage] = useState<"training" | "prompt" | "compare" | "quiz">("training");
  const [comparisonVisits, setComparisonVisits] = useState<Record<string, number[]>>({});
  const [comparisonRuns, setComparisonRuns] = useState<Record<string, number>>({});
  const [comparisonBeta, setComparisonBeta] = useState(0.75);
  const [mapVisits, setMapVisits] = useState<number[]>([]);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [editorMode, setEditorMode] = useState<"cell" | "color" | "object">("cell");
  const [selectedColor, setSelectedColor] = useState(LAB_COLORS[0]);
  const [selectedObject, setSelectedObject] = useState(LAB_OBJECTS[0]);
  const [editorError, setEditorError] = useState("");
  const [environmentUnderConstruction, setEnvironmentUnderConstruction] = useState(false);
  const constructionRef = useRef(false);
  useEffect(() => { constructionRef.current = environmentUnderConstruction; }, [environmentUnderConstruction]);
  const tRef=useRef(0);
  const totalReturnRef=useRef(0);
  const currentEpReturnRef=useRef(0);
  const gameWonRef=useRef(false); // Track game won state in ref to avoid race conditions
  const levelTransitionRef=useRef<ReturnType<typeof setTimeout> | null>(null); // Track timeout to clean up on unmount
  const isMountedRef=useRef(true);
  const collectedKeysRef=useRef<KeyId[]>([]);
  const currentLevelRef=useRef(currentLevel);
  const freePlayModeRef=useRef(freePlayMode);
  const episodeReturnsRef=useRef<PointEG[]>(episodeReturns);
  const gridWRef=useRef(gridW);
  const gridHRef=useRef(gridH);
  const perceptsRef = useRef(percepts);
  const seenPerceptsRef = useRef(seenPercepts);
  const level2StageRef = useRef(level2Stage);
  const comparisonVisitsRef = useRef<Record<string, number[]>>({});
  const comparisonRunsRef = useRef<Record<string, number>>({});
  const comparisonEpisodeBetaRef = useRef(0.75);
  const comparisonEpisodeVisitsRef = useRef<number[]>([]);
  const mapVisitsRef = useRef<number[]>([]);
  const episodeRewardsRef = useRef<RewardBreakdown>({ ...EMPTY_REWARD_BREAKDOWN });
  const psRef=useRef<PSLayer>(makeLevelMemory(grid, percepts, 1));
  const [displayMemory, setDisplayMemory] = useState(() => psRef.current.copy());
  const episodeNumberRef = useRef(1);
  const episodeStepsRef = useRef(0);
  const episodeEndRef = useRef<{ reason: EpisodeEnd; resumeAt: number } | null>(null);
  const decisionRef = useRef<LabDecision | null>(null);
  const rewardTraceRef = useRef<PointTR[]>([]);
  const cumTraceRef = useRef<PointTC[]>([]);
  const baseGridRef=useRef<CellType[][]>(cloneGrid(grid));
  const gridRef=useRef(grid); useEffect(()=>{gridRef.current=grid},[grid]);
  const agentRef=useRef(agent); useEffect(()=>{agentRef.current=agent},[agent]);
  const startPosRef=useRef(startPos); useEffect(()=>{startPosRef.current=startPos},[startPos]);
  // const windRef=useRef(wind); useEffect(()=>{windRef.current=wind},[wind]);
  const psLambdaRef=useRef(psLambda); useEffect(()=>{psLambdaRef.current=psLambda},[psLambda]);
  const psGammaRef=useRef(psGamma); useEffect(()=>{psGammaRef.current=psGamma},[psGamma]);
  const psGlowEtaRef=useRef(psGlowEta); useEffect(()=>{psGlowEtaRef.current=psGlowEta},[psGlowEta]);
  const greedinessRef=useRef(greediness); useEffect(()=>{greedinessRef.current=greediness},[greediness]);
  const stepCostRef=useRef(stepCost); useEffect(()=>{stepCostRef.current=stepCost},[stepCost]);
  const goalRewardRef=useRef(goalReward); useEffect(()=>{goalRewardRef.current=goalReward},[goalReward]);
  const trapPenaltyRef=useRef(trapPenalty); useEffect(()=>{trapPenaltyRef.current=trapPenalty},[trapPenalty]);
  const applyGridSize = (wInput: string, hInput: string) => {
    const wParsed = parseInt(wInput, 10);
    const hParsed = parseInt(hInput, 10);
    const nextW = Number.isFinite(wParsed) ? clamp(wParsed, 4, 30) : gridW;
    const nextH = Number.isFinite(hParsed) ? clamp(hParsed, 4, 22) : gridH;
    setGridW(nextW);
    setGridH(nextH);
    setGridWInput(String(nextW));
    setGridHInput(String(nextH));
    setGameWon(false);
    gameWonRef.current = false;
    setRunning(currentLevelRef.current !== 4 && playbackMode !== "click");
  };

  const text = UI_TEXT[language];
  const storyText = LAB_STORY_TEXT[language];
  const miscText = getMiscText(language);
  const featureText = LAB_FEATURE_TEXT[language];
  const isEnglish = language === "en";
  const currentLevelConfig = LEVELS.find(l => l.id === currentLevel);
  const currentLevelText = getLevelText(currentLevelConfig, language);
  const supportsDoorMechanics = currentLevel >= 3;
  const placedKeyIds = KEY_IDS.filter((keyId) => gridSome(grid, (cell) => cell === makeKeyCell(keyId)));
  const placedDoorIds = KEY_IDS.filter((keyId) => gridSome(grid, (cell) => cell === makeClosedDoorCell(keyId) || cell === makeOpenDoorCell(keyId)));
  const missingDoorKeyIds = placedDoorIds.filter((keyId) => !placedKeyIds.includes(keyId) && !collectedKeys.includes(keyId));
  const keyListFormatter = new Intl.ListFormat(language, { style: "short", type: "conjunction" });
  const formatKeyList = (keyIds: KeyId[]) => keyListFormatter.format(keyIds.map((keyId) => text.keyColors[keyId]));
  const getCellLabel = (cell: CellType) => {
    if (cell === "trap") return language === "de" ? "Dynamit-Falle 🧨" : "Dynamite trap 🧨";
    if (isKeyCell(cell)) {
      return `${text.keyBrushLabel} ${text.keyColors[getKeyIdFromCell(cell) as KeyId]}`;
    }
    if (isClosedDoorCell(cell)) {
      return `${text.doorBrushLabel} ${text.keyColors[getKeyIdFromCell(cell) as KeyId]}`;
    }
    if (isOpenDoorCell(cell)) {
      return `${text.openDoorBrushLabel} ${text.keyColors[getKeyIdFromCell(cell) as KeyId]}`;
    }
    return text.cellLabels[cell];
  };
  const keyStatus = collectedKeys.length
    ? `${text.keyStatusCollected}: ${formatKeyList(collectedKeys)}`
    : missingDoorKeyIds.length
      ? `${text.keyStatusMissing}: ${formatKeyList(missingDoorKeyIds)}`
    : placedKeyIds.length
      ? `${text.keyStatusAvailable}: ${formatKeyList(placedKeyIds)}`
      : text.keyStatusUnused;

  const clearLevelTransition = () => {
    if (levelTransitionRef.current) {
      clearTimeout(levelTransitionRef.current);
      levelTransitionRef.current = null;
    }
  };

  const resetSimulationState = (nextStart: { x: number; y: number }, nextGrid = baseGridRef.current, nextPercepts = perceptsRef.current) => {
    clearLevelTransition();
    setEpisode(1);
    episodeNumberRef.current = 1;
    episodeStepsRef.current = 0;
    episodeEndRef.current = null;
    decisionRef.current = null;
    rewardTraceRef.current = [];
    cumTraceRef.current = [];
    setEpisodeEnd(null);
    setEpisodeHolding(false);
    setLastDecision(null);
    setRewardTrace([]);
    setCumTrace([]);
    setEpisodeReturns([]);
    setPathAssessment(null);
    setCaseThreeAssessments(null);
    episodeRewardsRef.current = { ...EMPTY_REWARD_BREAKDOWN };
    setEpisodeRewards({ ...EMPTY_REWARD_BREAKDOWN });
    episodeReturnsRef.current = [];
    setCurrentEpReturn(0);
    setCollectedKeys([]);
    collectedKeysRef.current = [];
    setGameWon(false);
    gameWonRef.current = false;
    setFreePlayMode(false);
    freePlayModeRef.current = false;
    setFreePlayUnlocked(false);
    tRef.current = 0;
    totalReturnRef.current = 0;
    currentEpReturnRef.current = 0;
    setAgent(nextStart);
    agentRef.current = nextStart;
    psRef.current = makeLevelMemory(nextGrid, nextPercepts, currentLevelRef.current);
    setDisplayMemory(psRef.current.copy());
    setPsVersion((v) => v + 1);
    const initialSeen = new Set([perceptId(nextPercepts, nextGrid, nextStart.x, nextStart.y)]);
    seenPerceptsRef.current = initialSeen;
    setSeenPercepts(initialSeen);
    level2StageRef.current = "training";
    setLevel2Stage("training");
    comparisonVisitsRef.current = {};
    comparisonRunsRef.current = {};
    comparisonEpisodeBetaRef.current = 0.75;
    comparisonEpisodeVisitsRef.current = [];
    mapVisitsRef.current = [];
    setComparisonVisits({});
    setComparisonRuns({});
    setComparisonBeta(0.75);
    setMapVisits([]);
    setQuizAnswer(null);
    setEditorError("");
  };

  // Function to load a specific level
  const loadLevel = (levelId: number) => {
    const level = LEVELS.find(l => l.id === levelId);
    if (!level) return;
    currentLevelRef.current = levelId;
    if (levelId === 2) {
      setPlaybackMode("click");
      setRunning(false);
    }
    setEnvironmentUnderConstruction(levelId === 4);
    constructionRef.current = levelId === 4;

    // Update grid dimensions and preset
    setGridW(level.gridW);
    setGridH(level.gridH);
    setPreset(level.preset);
    const newGrid = level.id <= 2
      ? stripDoorMechanics(makeGrid(level.gridW, level.gridH, level.preset))
      : makeGrid(level.gridW, level.gridH, level.preset);
    const nextPercepts = makeLabPercepts(level.gridW, level.gridH, levelId);
    setPercepts(nextPercepts);
    perceptsRef.current = nextPercepts;
    setGrid(newGrid);
    gridRef.current = newGrid;
    baseGridRef.current = cloneGrid(newGrid);

    // Calculate start position based on new grid
    const newStartPos = findStartPosition(newGrid);
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
    if (level.lockedParams.greediness !== undefined) {
      setGreediness(level.lockedParams.greediness);
      greedinessRef.current = level.lockedParams.greediness;
    }
    if (level.lockedParams.stepCost !== undefined) {
      setStepCost(level.lockedParams.stepCost);
      stepCostRef.current = level.lockedParams.stepCost;
    }
    if (level.lockedParams.goalReward !== undefined) {
      setGoalReward(level.lockedParams.goalReward);
      goalRewardRef.current = level.lockedParams.goalReward;
    }
    if (level.lockedParams.trapPenalty !== undefined) {
      setTrapPenalty(level.lockedParams.trapPenalty);
      trapPenaltyRef.current = level.lockedParams.trapPenalty;
    }

    // Reset game state
    resetSimulationState(newStartPos, newGrid, nextPercepts);
    startPosRef.current = newStartPos; // Ensure ref is in sync
    setShowInstructions(true);
  };

  // Load initial level
  useEffect(() => {
    loadLevel(currentLevel);
  }, []);

  // Sync gameWonRef with gameWon state
  useEffect(() => {
    gameWonRef.current = gameWon;
  }, [gameWon]);

  useEffect(() => {
    currentLevelRef.current = currentLevel;
  }, [currentLevel]);

  useEffect(() => {
    freePlayModeRef.current = freePlayMode;
  }, [freePlayMode]);

  useEffect(() => {
    episodeReturnsRef.current = episodeReturns;
  }, [episodeReturns]);

  useEffect(() => {
    gridWRef.current = gridW;
  }, [gridW]);

  useEffect(() => {
    gridHRef.current = gridH;
  }, [gridH]);

  // Sync collected keys ref with state
  useEffect(() => {
    collectedKeysRef.current = collectedKeys;
  }, [collectedKeys]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearLevelTransition();
    };
  }, []);

  useEffect(() => { perceptsRef.current = percepts; }, [percepts]);

  useEffect(()=>{
    const g=(supportsDoorMechanics ? makeGrid(gridW,gridH,preset) : stripDoorMechanics(makeGrid(gridW,gridH,preset)));
    const nextPercepts = makeLabPercepts(gridW, gridH, currentLevel);
    perceptsRef.current = nextPercepts;
    setPercepts(nextPercepts);
    setGrid(g);
    gridRef.current = g;
    baseGridRef.current = cloneGrid(g);
    const sp=findStartPosition(g);
    setStartPos(sp);
    startPosRef.current = sp;
    setAgent(sp);
    agentRef.current = sp;
    resetSimulationState(sp, g, nextPercepts);
  },[gridW,gridH,preset]);

  useEffect(() => {
    setGridWInput(String(gridW));
  }, [gridW]);

  useEffect(() => {
    setGridHInput(String(gridH));
  }, [gridH]);

  useEffect(() => {
    if (!running || playbackMode === "click") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const pump = () => {
      if (cancelled || gameWonRef.current) return;
      const ending = episodeEndRef.current;
      if (ending && performance.now() < ending.resumeAt) {
        timer = setTimeout(pump, Math.min(100, ending.resumeAt - performance.now()));
        return;
      }
      if (ending) beginNextEpisode();
      if (playbackMode === "immediate") {
        // Yield between chunks so long episodes cannot freeze the controls.
        for (let i = 0; i < 200 && !episodeEndRef.current && !gameWonRef.current && (currentLevelRef.current !== 2 || ["training", "compare"].includes(level2StageRef.current)); i++) tick(false);
      } else tick();
      timer = setTimeout(pump, playbackMode === "slow" ? 850 : playbackMode === "fast" ? 80 : 0);
    };
    timer = setTimeout(pump, playbackMode === "slow" ? 850 : playbackMode === "fast" ? 80 : 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [running, playbackMode]);

  useEffect(() => {
    const ending = episodeEndRef.current;
    if (!episodeEnd || !ending) return;
    const timer = setTimeout(() => setEpisodeHolding(false), Math.max(0, ending.resumeAt - performance.now()));
    return () => clearTimeout(timer);
  }, [episodeEnd, episode]);

  function envReward(x:number,y:number){
    // Guard against out-of-bounds
    if (x < 0 || y < 0 || !gridRef.current[y] || gridRef.current[y].length === 0) {
      return stepCostRef.current;
    }
    
    const c=gridRef.current[y]?.[x];
    if(c==="goal") {
      return goalRewardRef.current;
    }
    if(c==="trap")return trapPenaltyRef.current;
    if(c==="wall")return -0.2;
    if(isKeyCell(c)) {
      const keyId = getKeyIdFromCell(c);
      if (keyId && !collectedKeysRef.current.includes(keyId)) {
        const nextKeys = [...collectedKeysRef.current, keyId];
        collectedKeysRef.current = nextKeys;
      }
      // Change the cell to empty after collecting key
      const newG = cloneGrid(gridRef.current);
      newG[y][x] = "empty";
      gridRef.current = newG;
      return 1;
    }
    return stepCostRef.current;
  }

  function isTerminal(x:number,y:number){
    if (x < 0 || y < 0 || !gridRef.current[y] || gridRef.current[y].length === 0) {
      return false;
    }
    const c=gridRef.current[y]?.[x];
    return c==="goal"||c==="trap";
  }

  function legal(x:number,y:number){
    if (x < 0 || y < 0 || x >= gridWRef.current || y >= gridHRef.current) return false;
    const cell = gridRef.current[y]?.[x];
    if (cell === "wall") return false;
    if (isClosedDoorCell(cell)) {
      const keyId = getKeyIdFromCell(cell);
      if (!keyId || !collectedKeysRef.current.includes(keyId)) return false;
    }
    return true;
  }

  function windJitter(a:number){
    // if(!windRef.current) return a;
    // const r=Math.random();
    // if(r<0.1) return (a+1)%4;
    // if(r<0.2) return (a+3)%4;
    return a;
  }

  function pickAction(x: number, y: number) {
    if (x < 0 || y < 0 || x >= gridWRef.current || y >= gridHRef.current) {
      return Math.floor(Math.random() * 4);
    }
    const keys = collectedKeysRef.current.length ? 1 : 0;
    const weights = ACTIONS.map((_, action) => psRef.current.getH(x, y, action, keys));
    const probabilities = labPolicy(weights, greedinessRef.current);
    const draw = Math.random();
    let cumulative = 0;
    for (let action = 0; action < probabilities.length; action++) {
      cumulative += probabilities[action];
      if (draw <= cumulative) return action;
    }
    return probabilities.length - 1;
  }

  function attemptMove(x:number,y:number,a:number){
    const actionIdx = windJitter(a);
    if (actionIdx < 0 || actionIdx >= ACTIONS.length) return {x, y};
    
    const next=stepXY(x,y,ACTIONS[actionIdx]);
    const c = gridRef.current[next.y]?.[next.x];
    if (!c) return {x, y};
    if (isClosedDoorCell(c)) {
      const keyId = getKeyIdFromCell(c);
      if (!keyId || !collectedKeysRef.current.includes(keyId)) {
        return {x, y, reward: -1, skipEnvReward: true};
      }
      const newG = cloneGrid(gridRef.current);
      newG[next.y][next.x] = makeOpenDoorCell(keyId);
      gridRef.current = newG;
      return {x: next.x, y: next.y, reward: 1, skipEnvReward: true};
    }
    if(!legal(next.x,next.y))return{x,y};
    return {x: next.x, y: next.y};
  }

  function recordComparisonVisit(x: number, y: number) {
    if (currentLevelRef.current !== 2 || level2StageRef.current !== "compare") return;
    const key = String(comparisonEpisodeBetaRef.current);
    if ((comparisonRunsRef.current[key] ?? 0) >= 5) return;
    const size = gridWRef.current * gridHRef.current;
    if (!comparisonEpisodeVisitsRef.current.length) comparisonEpisodeVisitsRef.current = Array(size).fill(0);
    if (!mapVisitsRef.current.length) mapVisitsRef.current = Array(size).fill(0);
    const total = comparisonVisitsRef.current[key]?.slice() ?? Array(size).fill(0);
    total[y * gridWRef.current + x] += 1;
    comparisonVisitsRef.current = { ...comparisonVisitsRef.current, [key]: total };
    comparisonEpisodeVisitsRef.current[y * gridWRef.current + x] += 1;
    mapVisitsRef.current[y * gridWRef.current + x] += 1;
  }

  function assessCaseThree(): CaseThreeAssessments | null {
    const sourceGrid = baseGridRef.current;
    const keyPoint = findCellPosition(sourceGrid, isKeyCell);
    const doorPoint = findCellPosition(sourceGrid, isClosedDoorCell);
    if (!keyPoint || !doorPoint) return null;
    const weightsAt = (x: number, y: number, keys: number) => ACTIONS.map((_, action) => psRef.current.getH(x, y, action, keys));
    return {
      key: timelyPathProbability(sourceGrid, startPosRef.current, weightsAt, greedinessRef.current, "key-blue", 2),
      door: timelyPathProbability(sourceGrid, keyPoint, weightsAt, greedinessRef.current, "door-blue-closed", 2, 1),
      watch: timelyPathProbability(sourceGrid, doorPoint, weightsAt, greedinessRef.current, "goal", 0, 1),
    };
  }

  function finishEpisode(lastReward: number, reason: EpisodeEnd){
    if (!Number.isFinite(lastReward)) {
      console.error("Invalid terminal reward encountered:", lastReward);
      setRunning(false);
      return;
    }
    const G=currentEpReturnRef.current;
    episodeEndRef.current = { reason, resumeAt: performance.now() + EPISODE_PAUSE_MS };
    const prevReturns = episodeReturnsRef.current;
    const nextReturns = [...prevReturns, { ep: (prevReturns.length ? prevReturns[prevReturns.length - 1].ep + 1 : 1), G }];
    setEpisodeReturns(nextReturns);
    episodeReturnsRef.current = nextReturns;

    const assessment = timelyPathProbability(baseGridRef.current, startPosRef.current,
      (x, y, keys) => ACTIONS.map((_, action) => psRef.current.getH(x, y, action, keys)),
      greedinessRef.current, "goal", currentLevelRef.current >= 4 ? 2 : 0);
    setPathAssessment(assessment);
    const nextCaseThreeAssessments = currentLevelRef.current === 3 ? assessCaseThree() : null;
    setCaseThreeAssessments(nextCaseThreeAssessments);
    if (currentLevelRef.current === 2 && level2StageRef.current === "training" && nextReturns.length >= 5) {
      const possible = new Set(baseGridRef.current.flatMap((row, y) => row.map((cell, x) =>
        cell === "wall" ? "" : perceptId(perceptsRef.current, baseGridRef.current, x, y),
      ).filter(Boolean)));
      if ([...possible].every((id) => seenPerceptsRef.current.has(id))) {
        level2StageRef.current = "prompt";
        setLevel2Stage("prompt");
        setRunning(false);
      }
    }
    if (currentLevelRef.current === 2 && level2StageRef.current === "compare") {
      const key = String(comparisonEpisodeBetaRef.current);
      const completed = Math.min(5, (comparisonRunsRef.current[key] ?? 0) + 1);
      comparisonRunsRef.current = { ...comparisonRunsRef.current, [key]: completed };
      setComparisonRuns(comparisonRunsRef.current);
      if (BETA_SETTINGS.every((beta) => (comparisonRunsRef.current[String(beta)] ?? 0) >= 5)) {
        level2StageRef.current = "quiz";
        setLevel2Stage("quiz");
        setRunning(false);
      } else if (completed === 5) setRunning(false);
    }
    const hasCampaignWin =
      !freePlayModeRef.current &&
      currentLevelRef.current !== 2 &&
      (currentLevelRef.current === 3
        ? Boolean(nextCaseThreeAssessments && Object.values(nextCaseThreeAssessments).every((item) => item.minimumSteps !== null && item.probability >= 0.75))
        : assessment.minimumSteps !== null && assessment.probability >= 0.75) &&
      !gameWonRef.current;

    if (hasCampaignWin) {
      gameWonRef.current = true;
      setGameWon(true);
      setRunning(false);

      if (currentLevelRef.current < LEVELS.length) {
        clearLevelTransition();
      } else {
        clearLevelTransition();
        setFreePlayMode(false);
        freePlayModeRef.current = false;
        setFreePlayUnlocked(true);
      }
    }
  }

  function beginNextEpisode() {
    episodeEndRef.current = null;
    episodeStepsRef.current = 0;
    decisionRef.current = null;
    // Reset episode grid from the scenario template so keys and doors are restored correctly.
    collectedKeysRef.current = [];
    const resetGrid = cloneGrid(baseGridRef.current);
    gridRef.current = resetGrid;
    
    // Reset for next episode (but don't reset game won state here)
    episodeNumberRef.current += 1;
    currentEpReturnRef.current=0;
    episodeRewardsRef.current = { ...EMPTY_REWARD_BREAKDOWN };
    agentRef.current=startPosRef.current;
    psRef.current.gvals.fill(0);
    comparisonEpisodeBetaRef.current = greedinessRef.current;
    comparisonEpisodeVisitsRef.current = [];
    recordComparisonVisit(startPosRef.current.x, startPosRef.current.y);
  }

  function publishSimulationSnapshot() {
    setGrid(gridRef.current);
    setAgent({ ...agentRef.current });
    setCollectedKeys([...collectedKeysRef.current]);
    setEpisode(episodeNumberRef.current);
    setCurrentEpReturn(currentEpReturnRef.current);
    setEpisodeRewards({ ...episodeRewardsRef.current });
    setEpisodeEnd(episodeEndRef.current?.reason ?? null);
    setEpisodeHolding(Boolean(episodeEndRef.current && performance.now() < episodeEndRef.current.resumeAt));
    setLastDecision(decisionRef.current);
    setSeenPercepts(new Set(seenPerceptsRef.current));
    setRewardTrace([...rewardTraceRef.current]);
    setCumTrace([...cumTraceRef.current]);
    setDisplayMemory(psRef.current.copy());
    setComparisonVisits(comparisonVisitsRef.current);
    setMapVisits([...mapVisitsRef.current]);
    setPsVersion((v) => v + 1);
  }

  function selectPlaybackMode(mode: PlaybackMode) {
    if (environmentUnderConstruction) return;
    if (mode === playbackMode) return;
    if (playbackMode === "immediate" && mode !== "immediate") publishSimulationSnapshot();
    setPlaybackMode(mode);
    setRunning(mode !== "click" && !gameWonRef.current && (currentLevelRef.current !== 2 || ["training", "compare"].includes(level2StageRef.current)));
  }

  function takeManualStep() {
    if (environmentUnderConstruction) return;
    if (gameWonRef.current) return;
    if (currentLevelRef.current === 2 && !["training", "compare"].includes(level2StageRef.current)) return;
    if (episodeEndRef.current && performance.now() < episodeEndRef.current.resumeAt) return;
    if (episodeEndRef.current) beginNextEpisode();
    tick();
  }

  function tick(displayStep = true){
    // Check game won using ref to avoid stale state issues
    if (gameWonRef.current) return;
    if (currentLevelRef.current === 4 && constructionRef.current) return;
    if (currentLevelRef.current === 2 && !["training", "compare"].includes(level2StageRef.current)) return;
    
    try {
      if (!gridRef.current.length || !gridRef.current[0]?.length) return;
      if (psRef.current.w !== gridWRef.current || psRef.current.h !== gridHRef.current) {
        psRef.current = makeLevelMemory(baseGridRef.current, perceptsRef.current, currentLevelRef.current);
        setPsVersion(v => v + 1);
      }
      const {x,y}=agentRef.current;
      
      // Validate agent position
      if (x < 0 || y < 0 || x >= gridWRef.current || y >= gridHRef.current) {
        console.warn("Agent out of bounds, resetting to start position");
        setAgent(startPosRef.current);
        agentRef.current = startPosRef.current;
        return;
      }
      
      const a=pickAction(x,y);
      const attempted = stepXY(x, y, ACTIONS[a]);
      const attemptedCell = gridRef.current[attempted.y]?.[attempted.x];
      const hadKeyForDoor = isClosedDoorCell(attemptedCell ?? "empty") && Boolean(getKeyIdFromCell(attemptedCell!) && collectedKeysRef.current.includes(getKeyIdFromCell(attemptedCell!)!));
      decisionRef.current = { percept: { x, y }, action: a };
      psRef.current.updateGlow(x, y, a, psGlowEtaRef.current, collectedKeysRef.current.length ? 1 : 0);
      const s1=attemptMove(x,y,a);
      
      // Validate new position
      if (s1.x < 0 || s1.y < 0 || s1.x >= gridWRef.current || s1.y >= gridHRef.current) {
        console.warn("Move resulted in out of bounds position");
        return;
      }
      
      const r = s1.skipEnvReward ? s1.reward : (s1.reward || 0) + envReward(s1.x,s1.y);
      seenPerceptsRef.current.add(perceptId(perceptsRef.current, baseGridRef.current, s1.x, s1.y, collectedKeysRef.current.length ? 1 : 0));
      if (!(currentLevelRef.current === 2 && level2StageRef.current === "compare")) {
        psRef.current.rewardUpdate(r,psGammaRef.current,psLambdaRef.current);
      }
      psRef.current.normalize();
      tRef.current+=1;
      totalReturnRef.current+=r;
      rewardTraceRef.current.push({ t: tRef.current, R: r });
      if (rewardTraceRef.current.length > 50) rewardTraceRef.current.shift();
      cumTraceRef.current.push({ t: tRef.current, C: totalReturnRef.current });
      if (cumTraceRef.current.length > 500) cumTraceRef.current.shift();
      currentEpReturnRef.current += r;
      if (attemptedCell === "goal" && s1.x === attempted.x && s1.y === attempted.y) episodeRewardsRef.current.watch += r;
      else if (attemptedCell && isKeyCell(attemptedCell) && s1.x === attempted.x && s1.y === attempted.y) episodeRewardsRef.current.key += r;
      else if (attemptedCell && isClosedDoorCell(attemptedCell) && hadKeyForDoor && s1.x === attempted.x && s1.y === attempted.y) episodeRewardsRef.current.door += r;
      else if (r === stepCostRef.current) episodeRewardsRef.current.steps += r;
      agentRef.current = { x: s1.x, y: s1.y };
      recordComparisonVisit(s1.x, s1.y);
      episodeStepsRef.current += 1;
      if (isTerminal(s1.x, s1.y)) finishEpisode(r, gridRef.current[s1.y][s1.x] === "goal" ? "goal" : "trap");
      else if (episodeStepsRef.current >= Math.max(200, gridWRef.current * gridHRef.current * 40)) finishEpisode(r, "limit");
      if (displayStep || episodeEndRef.current) publishSimulationSnapshot();
	    } catch (error) {
      console.error("Error during tick:", error);
      setRunning(false);
      gameWonRef.current = true;
    }
  }

  const roomRef = useRef<HTMLDivElement>(null);
  const [cellSize, setCellSize] = useState(46);
  useEffect(() => {
    const element = roomRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setCellSize(Math.max(28, Math.min(46, Math.floor((element.clientWidth - 18) / gridW)))));
    observer.observe(element);
    return () => observer.disconnect();
  }, [gridW]);
  const canvasW=gridW*cellSize;
  const canvasH=gridH*cellSize;
  const [tool,setTool]=useState<"draw"|"pick"|"erase">("draw");
  const [brush,setBrush]=useState<CellType>("empty");

  function onCellClick(x:number,y:number){
    if (currentLevelRef.current !== 4 || !constructionRef.current) return;
    setEditorError("");
    if (editorMode === "color" || editorMode === "object") {
      if (gridRef.current[y]?.[x] === "wall") return;
      const kind = editorMode === "color" ? "colors" : "objects";
      const matrix = perceptsRef.current[kind].map((row) => [...row]);
      matrix[y][x] = kind === "colors" ? selectedColor : selectedObject;
      const next = { ...perceptsRef.current, [kind]: matrix };
      perceptsRef.current = next;
      setPercepts(next);
      resetSimulationState(startPosRef.current, baseGridRef.current, next);
      return;
    }
    if(tool==="pick"){ setBrush(baseGridRef.current[y]?.[x] ?? "empty"); return; }
    const b = tool==="erase"?"empty":brush;
    if (!supportsDoorMechanics && (isKeyCell(b) || isDoorCell(b))) return;
    clearLevelTransition();
    const g = cloneGrid(baseGridRef.current);

    if (isDoorCell(b) && g[y][x] !== "wall" && !isDoorCell(g[y][x])) { setEditorError(language === "de" ? "Male zuerst eine Wand. Wähle dann Tür und klicke ein markiertes Wandfeld an." : "Paint a wall first, then select Door and click a highlighted wall cell."); return; }
    if (b === "goal") g.forEach((row) => row.forEach((cell, column) => { if (cell === "goal") row[column] = "empty"; }));
    if (isKeyCell(b)) g.forEach((row) => row.forEach((cell, column) => { if (cell === b) row[column] = "empty"; }));
    if (isDoorCell(b)) g.forEach((row) => row.forEach((cell, column) => { if (cell === b) row[column] = "wall"; }));

    if (b === "start") {
      for (let yy = 0; yy < gridH; yy++) {
        for (let xx = 0; xx < gridW; xx++) {
          if (g[yy][xx] === "start") {
            g[yy][xx] = "empty";
          }
        }
      }
      g[y][x] = "start";
    } else {
      g[y][x] = b;
    }

    if (!gridHasCell(g, "start")) {
      const fallbackStart = { x: clamp(startPosRef.current.x, 0, gridW - 1), y: clamp(startPosRef.current.y, 0, gridH - 1) };
      g[fallbackStart.y][fallbackStart.x] = "start";
    }

    const nextStart = findStartPosition(g);
    const keyPoint = g.flatMap((row, yy) => row.map((cell, xx) => isKeyCell(cell) ? { x: xx, y: yy } : null)).find((point) => point !== null);
    if (keyPoint && !reachableWithoutDoor(g, nextStart, keyPoint)) { setEditorError(language === "de" ? "Der Schlüssel muss ohne Tür vom Start aus erreichbar sein." : "The key must be reachable from the start before opening the door."); return; }
    setStartPos(nextStart);
    startPosRef.current = nextStart;
    setAgent(nextStart);
    agentRef.current = nextStart;

    setGrid(g);
    gridRef.current = g;
    baseGridRef.current = cloneGrid(g);
    setCollectedKeys([]);
    collectedKeysRef.current = [];
    setGameWon(false);
    gameWonRef.current = false;
    setFreePlayMode(false);
    setFreePlayUnlocked(false);
    setEpisode(1);
    setRewardTrace([]);
    setCumTrace([]);
    setEpisodeReturns([]);
    setPathAssessment(null);
    setCurrentEpReturn(0);
    tRef.current = 0;
    totalReturnRef.current = 0;
    currentEpReturnRef.current = 0;
    psRef.current = makeLevelMemory(g, perceptsRef.current, currentLevelRef.current);
    episodeNumberRef.current = 1;
    episodeStepsRef.current = 0;
    episodeEndRef.current = null;
    decisionRef.current = null;
    rewardTraceRef.current = [];
    cumTraceRef.current = [];
    setEpisodeEnd(null);
    setEpisodeHolding(false);
    setLastDecision(null);
    setDisplayMemory(psRef.current.copy());
    setPsVersion((v) => v + 1);
    
    // if(b==="start"){ setStartPos({x,y}); setAgent({x,y}); agentRef.current={x,y}; }
  }

const StaticGrid = React.memo(function StaticGrid({
  grid,
  percepts,
  editable,
  doorPlacement,
  gridW,
  gridH,
  cellSize,
  // cellBG,
  onCellClick,
  cellLabel,
}: {
  grid: CellType[][],
  percepts: LabPercepts,
  editable: boolean,
  doorPlacement: boolean,
  gridW: number,
  gridH: number,
  cellSize: number,
  // cellBG: (cell: CellType) => string,
  onCellClick: (x: number, y: number) => void,
  cellLabel: (cell: CellType) => string,
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
                onPointerDown={(e) => {
                  if (!editable) return;
                  e.preventDefault();
                  onCellClick(x, y);
                }}
                onPointerEnter={(e) => {
                  if (editable && e.buttons === 1) onCellClick(x, y);
                }}
                role={editable ? "button" : undefined}
                tabIndex={editable ? 0 : undefined}
                aria-label={`${cellLabel(cell)} (${x + 1}, ${y + 1})`}
                onKeyDown={(e) => {
                  if (!editable) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onCellClick(x, y);
                  }
                }}
                className={`adventure-cell academy-lab-cell ${!editable ? "lab-fixed-cell" : ""} ${cell === "wall" ? "lab-wall-cell" : ""} ${cell === "trap" ? "lab-trap-cell" : ""} ${doorPlacement && cell === "wall" ? "lab-door-target" : ""}`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  background: cell === "wall" ? "repeating-linear-gradient(135deg, #344e44, #344e44 5px, #405c50 5px, #405c50 10px)"
                    : cell === "trap" ? "repeating-radial-gradient(circle at center, #450910 0 5px, #98212b 6px 10px, #5f1019 11px 15px)"
                    : cell === "empty" || cell === "start" || cell === "goal" ? percepts.useColors ? percepts.colors[y][x] : "#fff" : cellBG(cell),
                }}
                title={`(${x},${y})`}
              >
                {(cell === "empty" || cell === "start" || cell === "goal") && (percepts.useObjects || cell === "goal") && (
                  <span className="cell-object" aria-hidden="true" style={{ background: percepts.useColors ? percepts.colors[y][x] : "#fff" }}>
                    {cell === "goal" ? "⌚" : percepts.objects[y][x]}
                  </span>
                )}
                {cell === "start" && (
                  <CirclePlay className="academy-start-marker" strokeWidth={2.5} />
                )}
                {isKeyCell(cell as CellType) && (
                  <KeyRound className="w-5 h-5 opacity-80" strokeWidth={2.5} style={{ color: keyAccentColor(cell as CellType) }} />
                )}
                {isClosedDoorCell(cell as CellType) && (
                  <DoorClosedLocked className="w-5 h-5 opacity-80" strokeWidth={2.5} style={{ color: keyAccentColor(cell as CellType) }} />
                )}
                {isOpenDoorCell(cell as CellType) && (
                  <DoorOpen className="w-5 h-5 opacity-80" strokeWidth={2.5} style={{ color: keyAccentColor(cell as CellType) }} />
                )}


              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});

  const isStruggling = episode >= 8 && (pathAssessment?.probability ?? 0) < 0.6;

  const tips: string[] = [];
  if (stepCost >= -0.01) {
    tips.push(language === "de" ? "Nutze kleine negative Schrittkosten, damit kurze Wege attraktiver werden." :
      language === "it" ? "Usa un piccolo costo negativo per favorire percorsi più brevi." :
      language === "fr" ? "Ajoute un léger coût négatif pour favoriser des trajets plus courts." :
      language === "es" ? "Usa un pequeño costo negativo para favorecer rutas más cortas." :
      "Use a small negative step cost so shorter paths look better.");
  }
  if (greediness < 0.5) {
    tips.push(language === "de" ? "Eine kleine inverse Temperatur verteilt die Auswahl gleichmäßiger. Erhöhe β vorsichtig, sobald Nova nützliche Wege gelernt hat." :
      "Low inverse temperature spreads choices more evenly. Increase β cautiously once Nova has learned useful routes.");
  }
  if (psGlowEta > 0.25) {
    tips.push(language === "de" ? "Senke η bei verzögerten Belohnungen, damit frühere Schritte länger berücksichtigt werden." :
      language === "it" ? "Riduci η se la ricompensa arriva tardi, così le azioni passate restano rilevanti." :
      language === "fr" ? "Réduis η si la récompense arrive tard, afin que les actions passées restent utiles." :
      language === "es" ? "Reduce eta cuando la recompensa llega tarde para conservar la influencia de acciones pasadas." :
      "Lower eta when rewards arrive late so earlier actions still receive credit.");
  }
  if (psGamma > 0.08) {
    tips.push(language === "de" ? "Ein hohes γ lässt den Agenten schnell vergessen. Niedrigere Werte helfen in schwierigeren Gittern." :
      language === "it" ? "Un γ alto fa dimenticare in fretta. Valori più bassi aiutano nelle griglie più difficili." :
      language === "fr" ? "Un γ élevé fait oublier trop vite. Des valeurs plus faibles aident sur les grilles difficiles." :
      language === "es" ? "Un γ alto hace que el agente olvide muy rápido. Valores más bajos ayudan en mapas difíciles." :
      "High g makes the agent forget quickly. Lower values help on harder maps.");
  }
  if (placedDoorIds.length > 0) {
    tips.push(language === "de" ? "Bei Tür-Leveln braucht der Agent zuerst den Schlüssel. Platziere mindestens einen Schlüssel und eine geschlossene Tür." :
      language === "it" ? "Nei livelli con porta l'agente deve prima prendere la chiave. Metti almeno una chiave e una porta chiusa." :
      language === "fr" ? "Dans les niveaux avec porte, l'agent doit d'abord récupérer la clé. Place au moins une clé et une porte fermée." :
      language === "es" ? "En niveles con puerta el agente debe coger antes la llave. Coloca al menos una llave y una puerta cerrada." :
      "On door levels the agent must collect a key first. Place at least one key and one closed door.");
  }
  if (gridHasCell(grid, "trap") && trapPenalty > -1) {
    tips.push(language === "de" ? "Wenn eine Falle kaum bestraft wird, wirken riskante Wege zu attraktiv. Erhöhe die Fallenstrafe." :
      language === "it" ? "Se la trap punisce poco, i percorsi rischiosi sembrano convenienti. Aumenta la penalità." :
      language === "fr" ? "Si la lave pénalise peu, les chemins dangereux paraissent trop avantageux. Augmente la pénalité." :
      language === "es" ? "Si la trap castiga poco, las rutas peligrosas parecen demasiado buenas. Aumenta la penalización." :
      "If trap is barely punished, risky routes look too good. Increase the trap penalty.");
  }
  if (tips.length === 0) {
    tips.push(language === "de" ? "Wenn du mehrere Parameter stark veränderst, setze das Level zurück und beobachte eine neue Lernphase." :
      language === "it" ? "Se cambi molto i parametri, resetta il livello e osserva una nuova fase di apprendimento." :
      language === "fr" ? "Si tu modifies fortement plusieurs paramètres, réinitialise le niveau et observe une nouvelle phase d'apprentissage." :
      language === "es" ? "Si cambias mucho varios parámetros, reinicia el nivel y observa una nueva fase de aprendizaje." :
      "If you change several parameters a lot, reset the level and watch a fresh learning run.");
  }

  const optimalParameterNotes = [
    language === "de" ? "γ (Vergessen): 0,005 bis 0,03 ist meist ein guter Startbereich." :
      language === "it" ? "γ (smorzamento memoria): 0,005-0,03 è spesso un buon intervallo iniziale." :
      language === "fr" ? "γ (amortissement de mémoire) : 0,005 à 0,03 est souvent une bonne plage de départ." :
      language === "es" ? "γ (amortiguación de memoria): 0,005 a 0,03 suele ser un buen rango inicial." :
      "γ (forgetting): 0.005 to 0.03 is usually a strong starting range.",
    language === "de" ? "λ (Belohnungssensitivität): 1 bis 3 verstärkt gute Wege, ohne das Lernen zu destabilisieren." :
      language === "it" ? "λ (accoppiamento ricompensa): 1-3 rafforza i percorsi buoni senza rendere instabile l'apprendimento." :
      language === "fr" ? "λ (couplage de récompense) : 1 à 3 renforce les bons chemins sans rendre l'apprentissage instable." :
      language === "es" ? "λ (acoplamiento de recompensa): 1 a 3 suele reforzar buenas rutas sin volver inestable el aprendizaje." :
      "λ (reward sensitivity): 1 to 3 often reinforces good routes without making learning unstable.",
    language === "de" ? "η (Glow-Abbau): 0,02 bis 0,15 hilft in Mehrschritt-Aufgaben, weil frühere Aktionen länger relevant bleiben." :
      language === "it" ? "η (decadimento glow): 0,02-0,15 aiuta nei compiti a più passi perché le azioni passate restano rilevanti più a lungo." :
      language === "fr" ? "η (décroissance du glow) : 0,02 à 0,15 aide sur les tâches à plusieurs étapes." :
      language === "es" ? "η (decaimiento del glow): 0,02 a 0,15 ayuda en tareas de varios pasos." :
      "η (glow decay): 0.02 to 0.15 helps on multi-step tasks because past actions stay relevant.",
    language === "de" ? "Inverse Temperatur: Starte mit Ausgewogen. Erkunden verteilt die Auswahl breiter; Nutzen bevorzugt gelernte Entscheidungen stärker." :
      "Inverse temperature: Start with Balance. Explore spreads choices more broadly; Exploit favors learned decisions more strongly.",
  ];
  const strategyNotes = [
    language === "de" ? "Beobachte zuerst die Episoden-Returns. Wenn sie flach bleiben, fehlen meist klarere Belohnungssignale oder weniger Exploration." :
      language === "it" ? "Guarda prima i ritorni per episodio. Se restano piatti, di solito servono ricompense migliori o meno esplorazione." :
      language === "fr" ? "Observe d'abord les retours par épisode. S'ils restent plats, il faut souvent de meilleurs signaux de récompense ou moins d'exploration." :
      language === "es" ? "Mira primero los retornos por episodio. Si se quedan planos, normalmente faltan mejores señales de recompensa o menos exploración." :
      "Start by watching episode returns. If they stay flat, the agent usually needs clearer rewards or less exploration.",
    language === "de" ? "Wenn Nova die Uhr findet, erhöhe β vorsichtig und prüfe die Kürzeste-Wege-Wahrscheinlichkeit am Ende der Episode." :
      "Once Nova finds the watch, increase β cautiously and check the shortest-path probability at the end of the episode.",
    language === "de" ? "Bei Tür-Leveln lohnt es sich, den Schlüsselpfad erst attraktiv zu machen und erst danach die Ziellinie zu optimieren." :
      language === "it" ? "Nei livelli con porte conviene prima rendere attraente il percorso verso la chiave e solo dopo ottimizzare la corsa finale." :
      language === "fr" ? "Sur les niveaux avec portes, rends d'abord le chemin vers la clé attractif avant d'optimiser l'arrivée finale." :
      language === "es" ? "En niveles con puertas conviene volver atractivo primero el camino hacia la llave y después optimizar la llegada final." :
      "On door levels, make the key route attractive first and only then optimize the final run to the goal.",
    language === "de" ? "Nutze " + text.resetLevel + " nach größeren Änderungen. Sonst mischst du neue Einstellungen mit alten h-Werten." :
      language === "it" ? "Usa Reset Level dopo modifiche grandi. Altrimenti mescoli i nuovi parametri con valori h appresi prima." :
      language === "fr" ? "Utilise Reset Level après de gros changements. Sinon, tu mélanges les nouveaux réglages avec d'anciennes valeurs h déjà apprises." :
      language === "es" ? "Usa Reset Level después de cambios grandes. Si no, mezclas ajustes nuevos con valores h aprendidos antes." :
      "Use Reset Level after large parameter changes. Otherwise you mix new settings with old learned h-values.",
  ];

  const editorBrushes: CellType[] = ["wall", "empty", "goal", "trap", "start", makeKeyCell("blue"), makeClosedDoorCell("blue")];
  const usedColors = [...new Set(percepts.colors.flat())];
  const usedObjects = [...new Set(percepts.objects.flat())];
  const updatePercepts = (next: LabPercepts) => {
    setPercepts(next);
    perceptsRef.current = next;
    resetSimulationState(startPosRef.current, baseGridRef.current, next);
  };

  const continueFreePlay = () => {
    clearLevelTransition();
    setFreePlayMode(true);
    freePlayModeRef.current = true;
    setFreePlayUnlocked(false);
    setGameWon(false);
    gameWonRef.current = false;
    beginNextEpisode();
    publishSimulationSnapshot();
    setRunning(playbackMode !== "click");
  };

  const goToNextLevel = () => {
    if (currentLevel >= LEVELS.length) return;
    clearLevelTransition();
    const nextLevel = currentLevel + 1;
    setCurrentLevel(nextLevel);
    loadLevel(nextLevel);
    setGameWon(false);
    gameWonRef.current = false;
    setRunning(false);
  };

  const selectBeta = (beta: number) => {
    if (beta === greedinessRef.current) return;
    setRunning(false);
    setComparisonBeta(beta);
    setGreediness(beta);
    greedinessRef.current = beta;
    const assessment = timelyPathProbability(baseGridRef.current, startPosRef.current,
      (x, y, keys) => ACTIONS.map((_, action) => psRef.current.getH(x, y, action, keys)), beta, "goal", currentLevelRef.current >= 4 ? 2 : 0);
    setPathAssessment(assessment);
    if (currentLevelRef.current === 3) setCaseThreeAssessments(assessCaseThree());
    if (level2StageRef.current === "compare") {
      mapVisitsRef.current = Array(gridWRef.current * gridHRef.current).fill(0);
      setMapVisits([...mapVisitsRef.current]);
      beginNextEpisode();
      publishSimulationSnapshot();
    }
  };

  const startLevelTwoComparison = () => {
    setRunning(false);
    psRef.current = makeLevelTwoComparisonMemory(baseGridRef.current, perceptsRef.current);
    setGreediness(0.75);
    greedinessRef.current = 0.75;
    setComparisonBeta(0.75);
    comparisonEpisodeBetaRef.current = 0.75;
    comparisonVisitsRef.current = {};
    comparisonRunsRef.current = {};
    mapVisitsRef.current = [];
    setComparisonVisits({});
    setComparisonRuns({});
    setMapVisits([]);
    level2StageRef.current = "compare";
    setLevel2Stage("compare");
    beginNextEpisode();
    publishSimulationSnapshot();
  };
  const shownMemory = displayMemory;
  const shownGreediness = greediness;
  const visitGrid = mapVisits.length ? grid.map((row, y) => row.map((_, x) => mapVisits[y * gridW + x] ?? 0)) : undefined;
  const levelSuccessLabel = currentLevel === 2
    ? `${storyText.fiveTrajectories} · ${storyText.takeQuiz}`
    : currentLevel === 3
      ? `${featureText.keyObjective} · ${featureText.doorObjective} · ${featureText.watchObjective} ≥ 75%`
      : currentLevel === 4
        ? `${featureText.shortestPath} (+2) ≥ 75%`
        : storyText.successCriterion;

  return (
    <div className="adventure-shell academy-lab">
      <header className="adventure-header academy-lab-header">
        <button className="academy-brand" onClick={onHome} aria-label={storyText.returnModes}>
          <span><Search /></span><div><strong>{storyText.brand}</strong><small>{storyText.subtitle}</small></div>
        </button>
        <span className="academy-lab-header-label">{storyText.title}</span>
        <div className="adventure-header-actions">
          <button className="header-home" onClick={onHome}><Home /><span>{storyText.modes}</span></button>
          <LanguageToggle language={language as AppLanguage} onChange={setLanguage} className="adventure-language-toggle" />
        </div>
      </header>
    {showInstructions && <div className="lab-level-overlay" role="dialog" aria-modal="true" aria-labelledby="lab-level-title">
      <div className="lab-level-intro">
        <img className="lab-level-character" src={CoachStanding} alt="Academy coach" />
        <div className="lab-level-card">
          <span className="story-eyebrow"><BookOpen size={18} /> {text.levelLabel} {currentLevel}</span>
          <h2 id="lab-level-title">{currentLevelText.name}</h2>
          <strong>{currentLevelText.description}</strong>
          <p>{currentLevelText.instructions}</p>
          <p className="lab-level-goal">{levelSuccessLabel}</p>
          <button className="button-primary" onClick={() => setShowInstructions(false)}>{storyText.continue}</button>
        </div>
        <img className="lab-level-character" src={NovaStanding} alt={storyText.agentLabel} />
      </div>
    </div>}

    {gameWon && !showInstructions && <div className="lab-level-overlay" role="dialog" aria-modal="true" aria-labelledby="lab-win-title" onClick={() => { setGameWon(false); gameWonRef.current = false; }}>
      <div className="lab-level-intro" onClick={(event) => event.stopPropagation()}>
        <img className="lab-level-character" src={CoachStanding} alt="Academy coach" />
        <div className="lab-level-card lab-win-card">
          <span className="story-eyebrow"><Trophy size={18} /> {storyText.case} {currentLevel}</span>
          <div className="lab-celebration" aria-hidden="true">🎉</div>
          <h2 id="lab-win-title">{storyText.youWon}</h2>
          {currentLevel < LEVELS.length ? <button className="button-primary" onClick={goToNextLevel}>{text.nextLevelButton}</button>
            : <button className="button-primary" onClick={continueFreePlay}>{text.continueFreePlay}</button>}
        </div>
        <img className="lab-level-character" src={NovaStanding} alt={storyText.agentLabel} />
      </div>
    </div>}

    {currentLevel === 2 && level2Stage === "prompt" && !showInstructions && <div className="lab-level-overlay" role="dialog" aria-modal="true" aria-labelledby="exploration-title">
      <div className="lab-level-intro">
        <img className="lab-level-character" src={CoachStanding} alt="Academy coach" />
        <div className="lab-level-card">
          <h2 id="exploration-title">{storyText.compareModes}</h2>
          <p>{storyText.explorePrompt}</p>
          <button className="button-primary" onClick={startLevelTwoComparison}>{storyText.continue}</button>
        </div>
        <img className="lab-level-character" src={NovaStanding} alt={storyText.agentLabel} />
      </div>
    </div>}

    {currentLevel === 2 && level2Stage === "quiz" && !gameWon && <div className="lab-level-overlay" role="dialog" aria-modal="true" aria-labelledby="exploration-quiz-title">
      <div className="lab-level-card lab-quiz-card">
        <h2 id="exploration-quiz-title">{storyText.quizQuestion}</h2>
        {storyText.quizAnswers.map((answer, index) => <button key={answer} className={`lab-quiz-answer ${quizAnswer === index ? "selected" : ""}`} onClick={() => setQuizAnswer(index)}>{answer}</button>)}
        {quizAnswer !== null && quizAnswer !== 1 && <p>{storyText.quizTryAgain}</p>}
        <button className="lab-quiz-review" onClick={() => { level2StageRef.current = "compare"; setLevel2Stage("compare"); }}>{storyText.reviewModes}</button>
        <button className="button-primary" disabled={quizAnswer !== 1} onClick={() => { setGameWon(true); gameWonRef.current = true; }}>{storyText.continue}</button>
      </div>
    </div>}
    
    {/* Info Modal */}
    {showInfo && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg">
          <CardHeader className="flex items-center justify-between sticky top-0 bg-white border-b">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Info className="w-6 h-6" /> {text.generalConcepts}
            </CardTitle>
            <button onClick={() => setShowInfo(false)} className="text-slate-500 hover:text-slate-700">
              <X className="w-6 h-6" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-700 text-sm p-6">
            {text.generalSections.map((section: { title: string; body: string; items?: Array<string | { label: string; body?: string }> }) => (
                <div key={section.title}>
                  <h3 className="font-bold mb-2">{section.title}</h3>
                  <p>{section.body}</p>
                  {section.items && (
                    <ul className="space-y-2 ml-4 mt-2">
                      {section.items.map((item: string | { label: string; body?: string }) => (
                        typeof item === "string" ? (
                          <li key={item}>{item}</li>
                        ) : (
                          <li key={item.label}>
                            <strong>{item.label}</strong> {item.body}
                          </li>
                        )
                      ))}
                    </ul>
                  )}
                </div>
              ))}
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
              <Brain className="w-6 h-6" /> {text.psModalTitle}
            </CardTitle>
            <button onClick={() => setShowPsInfo(false)} className="text-slate-500 hover:text-slate-700">
              <X className="w-6 h-6" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-700 text-sm p-6">
            {isEnglish ? (
              <>
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
                    <li><strong>Forgetting (γ):</strong> How quickly the agent forgets past experiences.</li>
                    <li><strong>Reward sensitivity (λ):</strong> How strongly rewards reinforce connections between memories.</li>
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
              </>
            ) : (
              text.psSections.map((section: { title: string; body: string; items?: Array<string | { label: string; body?: string }> }) => (
                <div key={section.title}>
                  <h3 className="font-bold mb-2">{section.title}</h3>
                  {section.body ? <p>{section.body}</p> : null}
                  {section.items && (
                    <ul className="space-y-2 ml-4 mt-2">
                      {section.items.map((item: string | { label: string; body?: string }) => (
                        typeof item === "string" ? (
                          <li key={item}>{item}</li>
                        ) : (
                          <li key={item.label}>
                            <strong>{item.label}</strong> {item.body}
                          </li>
                        )
                      ))}
                    </ul>
                  )}
                </div>
              ))
            )}
		            <div>
		              <h3 className="font-bold mb-2">{miscText.memoryEquationsTitle}</h3>
		              <div>
		              {isEnglish ? (
                    <p>
                      The <strong>strength of the connections between memories (clips)</strong> is stored in an <strong>h-value</strong>. For a transition from clip i to clip j, the strength is updated as follows upon receiving a reward R:
                    </p>
                  ) : (
                    <p>{miscText.memoryEquationsLead}</p>
                  )}
                <div className="ps-equations rounded border border-slate-200 bg-slate-50 p-3 text-slate-800">
                <div className="font-mono">
                  h<sub>ij</sub><sup>(next)</sup> = (1 − γ) × h<sub>ij</sub><sup>(now)</sup> + γ × h<sub>ij</sub><sup>(init)</sup> + R<sup>(t)</sup> × λ × g<sub>ij</sub><sup>(t)</sup>
                </div></div>
	              {isEnglish ? (
                    <p>
                      <strong>Glow values (g)</strong> represents the memory of the past transitions: the more recent a transition was experienced, the higher the glow value. Intuitively, glow is illuminating the path the agent took, and this "light" fades over time at a rate the depends on η. In Reinforcement Learning, glow can also be related to a so-called eligibility trace: it <strong>flags transitions that might have contributed to a certain reward value</strong>, allowing the agent to assign credit to not only the most recent action, but also to a sequence of past actions that led to the reward. The glow values are updated as follows:
                    </p>
                  ) : (
                    <p>{miscText.glowLead}</p>
                  )}
	              <div className="ps-equations rounded border border-slate-200 bg-slate-50 p-3 text-slate-800 space-y-2">
	                <div className="font-mono">g<sub>ij</sub><sup>(next)</sup> = g<sub>ij</sub><sup>(now)</sup> × (1 − η)</div>
	              </div>
	              {isEnglish ? (
                    <p>
                      and if the transition from clip i to clip j was <strong>just experienced</strong>, then glow is set to 1:
                    </p>
                  ) : (
                    <p>{miscText.glowRecent}</p>
                  )}
		               <div className="ps-equations rounded border border-slate-200 bg-slate-50 p-3 text-slate-800 space-y-2">
		                <div className="font-mono">g<sub>ij</sub><sup>(next)</sup> = 1 </div>
		              </div>
		              </div>
	            </div>
	          </CardContent>
        </Card>
      </div>
    )}

    {showTips && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg">
          <CardHeader className="flex items-center justify-between sticky top-0 bg-white border-b">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Lightbulb className="w-6 h-6" /> {text.tipsModalTitle}
            </CardTitle>
            <button onClick={() => setShowTips(false)} className="text-slate-500 hover:text-slate-700">
              <X className="w-6 h-6" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-700 text-sm p-6">
            <div>
              <h3 className="font-bold mb-2">{text.tipsTitle}</h3>
              <p className="mb-3">{text.tipsLead}</p>
              <ul className="list-disc list-inside space-y-1">
                {strategyNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2">{text.strugglingTitle}</h3>
              <ul className="list-disc list-inside space-y-1">
                {tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-bold mb-2">{text.optimalParamsTitle}</h3>
              <p className="mb-3">{text.optimalParamsLead}</p>
              <ul className="list-disc list-inside space-y-1">
                {optimalParameterNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    )}
    
    <div className="academy-lab-content">
      <section className="lesson-intro lesson-intro-row academy-lab-intro">
        <div>
          <p>{storyText.summary}</p>
        </div>
        <div className="nova-face-medal" aria-label={storyText.novaPortrait}><img src={NovaFace} alt="Nova" /></div>
      </section>
    <Card className="academy-lab-toolbar">
    <CardHeader className="academy-lab-toolbar-inner">
      <div className="academy-lab-toolbar-status">
        <strong>{storyText.case} {currentLevel} · {currentLevelText.name}</strong>
        <div className="lab-banner-case-menu">
          <Label className="text-sm !text-slate-700">{storyText.case}:</Label>
          <Select value={freePlayMode ? "free-play" : currentLevel.toString()} onValueChange={(value) => {
            if (value === "free-play") { continueFreePlay(); return; }
            const levelId = parseInt(value, 10);
            setCurrentLevel(levelId);
            loadLevel(levelId);
            setRunning(false);
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEVELS.map(level => <SelectItem key={level.id} value={level.id.toString()}>{level.id}. {getLevelText(level, language).name}</SelectItem>)}
              {(freePlayUnlocked || freePlayMode) && <SelectItem value="free-play">{text.freePlayMenu}</SelectItem>}
            </SelectContent>
          </Select>
          <button onClick={() => setShowInstructions(true)} title={miscText.instructionsButtonTitle} aria-label={miscText.instructionsButtonTitle}><BookOpen size={20} /></button>
        </div>
    {freePlayMode && <span className="academy-free-play" title={text.freePlayActive}>{text.freePlayMenu}</span>}
    </div>
    <div className="academy-lab-controls">
    <button onClick={() => setShowInfo(true)} title={miscText.infoButtonTitle} className="text-slate-500 hover:text-slate-700 transition-colors">
      <Info className="w-5 h-5 sm:w-6 sm:h-6" />
    </button>
    <Button
        variant="outline"
        size="sm"
        onClick={() => loadLevel(currentLevel)}
        className="button-secondary"
      >
        <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> {text.resetLevel}
    </Button>
    <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setCurrentLevel(1);
          loadLevel(1);
        }}
        className="button-secondary"
      >
        <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4 mr-1" /> {text.resetGame}
    </Button>
    </div>
    </CardHeader>
    </Card>

      <div className={`academy-lab-panels ${currentLevel === 2 ? "academy-lab-level-two" : ""}`}>
         <Card className="lesson-panel environment-panel academy-lab-panel">
          <div className="panel-heading panel-heading-with-counter"><span><Search /></span><div><strong>{storyText.trainingRoom}</strong><small>{storyText.environmentHint.replace("{reward}", String(goalReward))}</small></div><div className="card-counter"><strong>{episode}</strong><small>{storyText.trajectories}</small></div></div>
          <CardContent className="space-y-3">
              {currentLevel >= 3 && <div className="flex flex-wrap items-center gap-2">
                <Label className="text-sm !text-slate-700">{text.keyStatus}:</Label>
                <span className="text-sm text-slate-700 break-words">{keyStatus}</span>
              </div>}
              <fieldset className="lab-playback-modes" disabled={environmentUnderConstruction}><legend>{storyText.playback}</legend><div>{(["click", "slow", "fast", "immediate"] as PlaybackMode[]).map((mode) => <button type="button" key={mode} aria-pressed={playbackMode === mode} title={storyText.playbackHints[mode]} onClick={() => selectPlaybackMode(mode)}>{storyText.playbackModes[mode]}</button>)}</div></fieldset>
              <Button variant={running ? "secondary" : "default"} size="sm"
                onClick={() => playbackMode === "click" ? takeManualStep() : setRunning(r => !r)}
                disabled={gameWon || environmentUnderConstruction || (playbackMode === "click" && episodeHolding) || (currentLevel === 2 && ["prompt", "quiz"].includes(level2Stage))}
                className={`lab-move-button ${running ? "button-secondary" : "button-primary"}`}>
                {playbackMode === "click" ? <><Footprints className="w-4 h-4 mr-1" />{episodeEnd ? storyText.nextStep : storyText.step}</> : running ? <><Pause className="w-4 h-4 mr-1" />{text.pause}</> : <><Play className="w-4 h-4 mr-1" />{text.run}</>}
              </Button>
              {episodeEnd && <div className={`lab-episode-ending ${episodeEnd}`} role="status"><strong>{storyText.episodeFinished}</strong><span>{storyText.episodeOutcomes[episodeEnd]}</span></div>}
            <div className="academy-environment-body">
              <div ref={roomRef} className="academy-grid-scroll">
                <div className="academy-training-grid" style={{ width: canvasW, height: canvasH }}>
                {/* Static grid layer */}
                  <StaticGrid
                  grid={grid}
                  percepts={percepts}
                  editable={currentLevel === 4 && environmentUnderConstruction}
                  doorPlacement={currentLevel === 4 && environmentUnderConstruction && editorMode === "cell" && isDoorCell(brush)}
                  gridW={gridW}
                  gridH={gridH}
                  cellSize={cellSize}
                  // cellBG={cellBG}
                  onCellClick={onCellClick}
                  cellLabel={getCellLabel}
                />

                {/* Agent overlay */}
                <motion.div
                  layoutId="agent"
                  className="academy-lab-agent"
                  aria-label={storyText.agentLabel}
                  initial={false}
                  animate={{
                    left: agent.x * cellSize + (cellSize - 40) / 2,
                    top: agent.y * cellSize + (cellSize - 40) / 2,
                    scale: 1,
                  }}
                  transition={{ type: "tween", duration: playbackMode === "immediate" ? 0 : playbackMode === "fast" ? 0.055 : 0.25 }}
                >
                  <span className={`student-token ${running ? "student-active" : ""}`}><img src={NovaFace} alt={storyText.novaPortrait} /></span>
                </motion.div>
                  </div>
              </div>

              <RewardSummary rewards={episodeRewards} stepCost={stepCost} goalReward={goalReward} showKey={gridSome(baseGridRef.current, isKeyCell)} showDoor={gridSome(baseGridRef.current, isDoorCell)} labels={featureText} />

              {currentLevel === 4 && <details className="academy-room-controls academy-parameter-settings" open={environmentUnderConstruction} onToggle={(event) => {
                const open = event.currentTarget.open;
                constructionRef.current = open;
                setEnvironmentUnderConstruction(open);
                if (open) setRunning(false);
              }}>
                  <summary>{storyText.roomEditor}{environmentUnderConstruction ? ` · ${featureText.construction}` : ""}</summary>
                  <p className="lab-construction-hint">{featureText.constructionHint}</p>
                  <div className="lab-editor-group">
                    <h4>{language === "de" ? "Größe" : "Size"}</h4>
                    <div className="grid w-full grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-end gap-2">
                      <div>
                        <Label className="mb-1 text-slate-700">{text.width}</Label>
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
                        <Label className="mb-1 text-slate-700">{text.height}</Label>
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
                        onClick={() => applyGridSize(gridWInput, gridHInput)}
                        className="w-full"
                      >
                        {text.apply}
                      </Button>
                    </div>
                  </div>

                {/*<div className="flex-col grid grid-cols-3 gap-2 mt-3 ustify-center items-center">
                      <Button variant={tool==="draw"?"default":"outline"} onClick={()=>setTool("draw")}><MousePointer2 className="w-4 h-4 mr-1"/>Draw</Button>
                      <Button variant={tool==="pick"?"default":"outline"} onClick={()=>setTool("pick")}><Wand2 className="w-4 h-4 mr-1"/>Pick</Button>
                      <Button variant={tool==="erase"?"default":"outline"} onClick={()=>setTool("erase")}><Eraser className="w-4 h-4 mr-1"/>Erase</Button>
                    </div>*/}

	                    <div className="lab-editor-group">
                      <h4>{language === "de" ? "Ziele und Hindernisse" : "Objectives and obstacles"}</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 py-2 text-xs">
	                      {editorBrushes.map(c => (
	                        <button
                            key={c}
                            onClick={()=>{ setEditorMode("cell"); setBrush(c); setTool("draw"); }}
                            className="min-h-10 rounded-md border p-2 flex items-center justify-center text-center"
                            style={editorBrushButtonStyle(c, editorMode === "cell" && brush === c && tool === "draw")}
                          >
                            {getCellLabel(c)}
                          </button>
	                      ))}
	                      </div>
                      <small>{isDoorCell(brush) && editorMode === "cell"
                        ? language === "de" ? "Klicke ein markiertes Wandfeld an, um die Tür einzusetzen." : "Click a highlighted wall cell to insert the door."
                        : language === "de" ? "Wähle Wände ausdrücklich aus. Male dann eine Wand und setze die Tür auf ein Wandfeld. Der Schlüssel muss ohne Tür vom Start aus erreichbar sein." : "Select Walls to paint them. Then select Door and click a wall cell. The key must be reachable from the start without opening a door."}</small>
                      {editorError && <p className="lab-editor-error" role="alert">{editorError}</p>}
                    </div>

                    <div className="lab-editor-group">
                      <h4>{language === "de" ? "Belohnungen" : "Rewards"}</h4>
                      <SliderWithVal locale={language} label={text.goalReward} min={0.1} max={20} step={0.1} value={goalReward} onChange={setGoalReward} help={text.envSliderHelp.goalReward} />
                      <SliderWithVal locale={language} label={text.trapPenalty} min={-10} max={-0.1} step={0.1} value={trapPenalty} onChange={setTrapPenalty} help={text.envSliderHelp.trapPenalty} />
                      <SliderWithVal locale={language} label={text.stepCost} min={-0.2} max={0} step={0.01} value={stepCost} onChange={setStepCost} help={text.envSliderHelp.stepCost} />
                    </div>

                    <div className="lab-percept-editor">
                      <strong>{language === "de" ? "Perzepte" : "Percepts"}</strong>
                      <div className="lab-percept-toggles">
                        <label><input type="checkbox" checked={percepts.useColors} onChange={(event) => { if (event.target.checked || percepts.useObjects) updatePercepts({ ...percepts, useColors: event.target.checked }); }} />{language === "de" ? "Farben" : "Colors"}</label>
                        <label><input type="checkbox" checked={percepts.useObjects} onChange={(event) => { if (event.target.checked || percepts.useColors) updatePercepts({ ...percepts, useObjects: event.target.checked }); }} />{language === "de" ? "Gegenstände" : "Objects"}</label>
                      </div>
                      {percepts.useColors && <div>
                        <small>{language === "de" ? "Verwendete Farben (× entfernt sie)" : "Colors in the grid (× removes one)"}</small>
                        <div className="lab-percept-palette">{usedColors.map((color) => <span key={color}><button className={editorMode === "color" && selectedColor === color ? "selected" : ""} style={{ background: color }} aria-label={`${color} ${language === "de" ? "aufmalen" : "paint"}`} onClick={() => { setEditorMode("color"); setSelectedColor(color); }} />{usedColors.length > 1 && <button aria-label={`${language === "de" ? "Farbe entfernen" : "Remove color"} ${color}`} onClick={() => updatePercepts(replacePerceptValue(percepts, "colors", color, usedColors.find((value) => value !== color)!))}>×</button>}</span>)}</div>
                        <small>{language === "de" ? "Farbe wählen und dann Zellen anklicken" : "Choose a color, then click cells to repeat it"}</small>
                        <div className="lab-percept-palette">{LAB_COLORS.map((color) => <button key={color} style={{ background: color }} aria-label={`${language === "de" ? "Farbe wählen" : "Choose color"} ${color}`} onClick={() => { setEditorMode("color"); setSelectedColor(color); }} />)}</div>
                      </div>}
                      {percepts.useObjects && <div>
                        <small>{language === "de" ? "Verwendete Gegenstände (× entfernt sie)" : "Objects in the grid (× removes one)"}</small>
                        <div className="lab-percept-palette">{usedObjects.map((object) => <span key={object}><button className={editorMode === "object" && selectedObject === object ? "selected" : ""} onClick={() => { setEditorMode("object"); setSelectedObject(object); }}>{object}</button>{usedObjects.length > 1 && <button aria-label={`${language === "de" ? "Gegenstand entfernen" : "Remove object"} ${object}`} onClick={() => updatePercepts(replacePerceptValue(percepts, "objects", object, usedObjects.find((value) => value !== object)!))}>×</button>}</span>)}</div>
                        <small>{language === "de" ? "Gegenstand wählen und dann Zellen anklicken" : "Choose an object, then click cells to repeat it"}</small>
                        <div className="lab-percept-palette">{LAB_OBJECTS.map((object) => <button key={object} onClick={() => { setEditorMode("object"); setSelectedObject(object); }}>{object}</button>)}</div>
                      </div>}
                    </div>

                  {/* </CardContent> */}
                {/* </Card> */}

                {/* <Card className="rounded-xl">
                  <CardHeader>
                    <CardTitle className="text-lg">PS Parameters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <SliderWithVal label="Forgetting (γ)" min={0.01} max={1} step={0.01} value={psGamma} onChange={setPsGamma}/>
                    <SliderWithVal label="Reward sensitivity (λ)" min={0} max={10} step={1} value={psLambda} onChange={setPsLambda}/>
                    <SliderWithVal label="Glow decay (η)" min={0} max={1} step={0.01} value={psGlowEta} onChange={setPsGlowEta}/>
                    <SliderWithVal label="Softmax temperature (β)" min={0.05} max={5} step={0.05} value={greediness} onChange={setGreediness}/>
                    <div className="text-sm text-neutral-600">Episode: {episode} · Current G: {fmt(currentEpReturn)}</div>
                    <div className="text-xs text-neutral-500">Total return: {fmt(totalReturnRef.current)}</div>
                  </CardContent>
                </Card> */}

                {/* <RewardsPanel rewardTrace={rewardTrace} cumTrace={cumTrace} episodeReturns={episodeReturns} /> */}
              </details>}
            </div>
          </CardContent>
        </Card>

        <Card className="lesson-panel memory-panel-wide academy-lab-panel">
          <div className="panel-heading"><span><Brain /></span><div><strong>{storyText.memoryTitle}</strong><small>{storyText.memoryHint}</small></div><button className="memory-info-button" onClick={() => setShowPsInfo(true)} title={text.learnMorePS} aria-label={text.learnMorePS}><Info /></button></div>
          <CardContent className="min-w-0 overflow-x-hidden">
            <MemoryTabs value={memoryView} onChange={setMemoryView} text={storyText} />
            {currentLevel === 2 && <div className="lab-memory-compare">
              <PerceptGraph grid={baseGridRef.current} percepts={percepts} ps={shownMemory} text={storyText} labels={featureText} view={memoryView} greediness={shownGreediness} seen={seenPercepts} />
              <div className="lab-map-view" data-memory-revision={psVersion}>
                <strong>{storyText.mapView}</strong>
                <PSInspectorErrorBoundary text={miscText}>
                  <PSInspector grid={baseGridRef.current} percepts={percepts} ps={shownMemory} text={storyText} view={memoryView === "glow" ? "h" : memoryView} agent={agent} greediness={shownGreediness} seenPercepts={seenPercepts} visitCounts={visitGrid} compact heatmap showGlowHalo={false} />
                </PSInspectorErrorBoundary>
                {visitGrid && <small>{storyText.visited}</small>}
              </div>
            </div>}
            {currentLevel !== 2 && <div className="lab-memory-workspace">
              <LabDecisionReadout decision={lastDecision} agent={agent} grid={baseGridRef.current} percepts={percepts} text={storyText} />
              <div data-memory-revision={psVersion}>
                <PSInspectorErrorBoundary text={miscText}>
                  <PSInspector grid={baseGridRef.current} percepts={percepts} ps={shownMemory} text={storyText} view={memoryView} agent={agent} greediness={shownGreediness} keyState={collectedKeys.length > 0} />
                </PSInspectorErrorBoundary>
              </div>
            </div>}
            <details className="view-explanation"><summary>{storyText.memoryRepresentation}</summary><p>{memoryView === "glow" ? storyText.glowExplanation : memoryView === "h" ? storyText.hExplanation : storyText.policyExplanation}</p></details>
          </CardContent>
          <details className="academy-parameter-settings" key={`memory-parameters-${currentLevel}`}>
                    <summary>{storyText.tuneMemory}</summary>
                  <CardContent className="space-y-3">
                    <SliderWithVal locale={language} label={text.paramLabels.psGlowEta} min={0} max={0.3} scale="log" value={psGlowEta} onChange={setPsGlowEta} help={text.paramHelp.psGlowEta} />
                    <SliderWithVal label={text.paramLabels.psGamma} locale={language} min={0} max={0.3} scale="log" value={psGamma} onChange={setPsGamma} help={text.paramHelp.psGamma} />
                  </CardContent>
                  </details>
          {currentLevel >= 2 && <>
            <BetaSelector value={currentLevel === 2 ? comparisonBeta : greediness} onChange={selectBeta} text={storyText} histogramLabel={featureText.visitFrequencies} positionAxis={featureText.positionAxis} frequencyAxis={featureText.frequencyAxis} runs={currentLevel === 2 ? comparisonRuns : undefined} visits={currentLevel === 2 ? comparisonVisits : undefined} grid={baseGridRef.current} colors={percepts.colors} gridW={gridW} showHistograms={currentLevel === 2} />
            {currentLevel === 2 && level2Stage === "compare" && <small className="lab-compare-hint">{storyText.compareRunHint}</small>}
            {currentLevel === 2 && BETA_SETTINGS.every((value) => (comparisonRuns[String(value)] ?? 0) >= 5) && <button className="lab-compare-quiz" onClick={() => { level2StageRef.current = "quiz"; setLevel2Stage("quiz"); }}>{storyText.takeQuiz}</button>}
          </>}
        </Card>
        <Card className="lesson-panel forgetting-panel practice-progress academy-lab-panel">
          <div className="panel-heading"><span><Trophy /></span><div><strong>{storyText.progressTitle}</strong><small>{storyText.progressHint}</small></div></div>
          <CardContent className="space-y-2">
            <div className="lab-objectives-with-coach">
              <div className="lab-objectives-coach">
                <img src={CoachPortrait} alt="Academy coach" />
                <span>{featureText.yourObjectives}</span>
              </div>
              <div className="lab-learning-cursors">
                <ProgressCursor label={featureText.instantReward} value={rewardTrace.at(-1)?.R ?? 0} min={Math.min(trapPenalty, stepCost, -1)} max={Math.max(goalReward, 1)} />
                {currentLevel === 3 ? <>
                  <ProgressCursor label={featureText.keyObjective} value={caseThreeAssessments?.key.probability ?? 0} min={0} max={1} target={0.75} targetLabel={featureText.objectiveMark} format={(value) => `${(value * 100).toFixed(1)}%`} />
                  <ProgressCursor label={featureText.doorObjective} value={caseThreeAssessments?.door.probability ?? 0} min={0} max={1} target={0.75} targetLabel={featureText.objectiveMark} format={(value) => `${(value * 100).toFixed(1)}%`} />
                  <ProgressCursor label={featureText.watchObjective} value={caseThreeAssessments?.watch.probability ?? 0} min={0} max={1} target={0.75} targetLabel={featureText.objectiveMark} format={(value) => `${(value * 100).toFixed(1)}%`} />
                </> : <ProgressCursor label={featureText.shortestPath} value={pathAssessment?.probability ?? 0} min={0} max={1} target={0.75} targetLabel={featureText.objectiveMark} format={(value) => `${(value * 100).toFixed(1)}%`} />}
              </div>
            </div>
            {currentLevel === 3 && isStruggling && <div className="lab-struggle-hint"><Lightbulb size={17} /> {language === "de" ? "Tipp: Halte Glow länger aktiv (kleineres η), damit die späte Belohnung frühere Schritte stärkt. Senke γ, wenn nützliche Verknüpfungen verblassen; erhöhe β erst, wenn gute H-Werte sichtbar sind." : "Hint: Lower glow decay η so the late reward can reinforce earlier steps. Lower forgetting γ if useful links fade, then raise β once good H-values are visible."}</div>}
              <p className="text-sm text-neutral-600">{text.stats.episode}: {episode} · {text.stats.currentReturn}: {fmt(currentEpReturn)} · {text.stats.totalReturn}: {fmt(totalReturnRef.current)}</p>
            <p className="lab-chart-hint">{featureText.chartsHint}</p>
            <RewardsPanel rewardTrace={rewardTrace} cumTrace={cumTrace} episodeReturns={episodeReturns} text={text} miscText={miscText} />
            <details className="academy-tip practice-coach"><summary><Lightbulb /> {storyText.coachObservation}</summary><p>{storyText.observation}</p></details>
          </CardContent>
        </Card>
      </div>
      <div className="academy-lab-footer">
        <Button
          variant={isStruggling ? "default" : "outline"}
          onClick={() => setShowTips(true)}
          className="flex items-center gap-2"
        >
          <Lightbulb className="w-4 h-4" />
          {isStruggling ? text.strugglingTitle : text.tipsButton}
        </Button>
        <div className="academy-share"><img src={qrCode} alt="QR code" /><span>{storyText.share}</span></div>
      </div>
      </div>
    </div>
  );
}

function fmt(v:number){
  if (!Number.isFinite(v)) return "0.00";
  return (Math.round(v * 100) / 100).toFixed(2);
}

function keyAccentColor(cell: CellType) {
  const keyId = getKeyIdFromCell(cell);
  switch (keyId) {
    case "blue":
      return "#2563eb";
    case "red":
      return "#dc2626";
    case "green":
      return "#16a34a";
    default:
      return "#475569";
  }
}

function cellBG(c: CellType){
  if (isKeyCell(c)) {
    switch (getKeyIdFromCell(c)) {
      case "blue": return "#bfdbfe";
      case "red": return "#fecaca";
      case "green": return "#bbf7d0";
      default: return "#e2e8f0";
    }
  }
  if (isClosedDoorCell(c)) {
    switch (getKeyIdFromCell(c)) {
      case "blue": return "#1d4ed8";
      case "red": return "#b91c1c";
      case "green": return "#15803d";
      default: return "#8b5e34";
    }
  }
  if (isOpenDoorCell(c)) {
    switch (getKeyIdFromCell(c)) {
      case "blue": return "#dbeafe";
      case "red": return "#fee2e2";
      case "green": return "#dcfce7";
      default: return "#ffe7d6";
    }
  }
  switch (c){
    case "wall": return "#cbd5e1";
    case "goal": return "#a7f3d0";
    case "trap": return "#fecaca";
    case "start": return "#fde68a";
    default: return "#ffffff";
  }
}

function editorBrushButtonStyle(c: CellType, selected: boolean): React.CSSProperties {
  const selectedRing = selected ? "0 0 0 2px rgba(15, 23, 42, 0.9) inset" : "0 0 0 1px rgba(148, 163, 184, 0.6) inset";
  if (isKeyCell(c)) {
    switch (getKeyIdFromCell(c)) {
      case "blue":
        return { background: "linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)", borderColor: "#2563eb", color: "#1d4ed8", boxShadow: selectedRing };
      case "red":
        return { background: "linear-gradient(135deg, #fff1f2 0%, #fecdd3 100%)", borderColor: "#e11d48", color: "#be123c", boxShadow: selectedRing };
      case "green":
        return { background: "linear-gradient(135deg, #ecfdf5 0%, #bbf7d0 100%)", borderColor: "#16a34a", color: "#15803d", boxShadow: selectedRing };
      default:
        return { background: "#f8fafc", borderColor: "#64748b", color: "#334155", boxShadow: selectedRing };
    }
  }
  if (isClosedDoorCell(c)) {
    switch (getKeyIdFromCell(c)) {
      case "blue":
        return { background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", borderColor: "#1e40af", color: "#eff6ff", boxShadow: selectedRing };
      case "red":
        return { background: "linear-gradient(135deg, #881337 0%, #e11d48 100%)", borderColor: "#be123c", color: "#fff1f2", boxShadow: selectedRing };
      case "green":
        return { background: "linear-gradient(135deg, #14532d 0%, #16a34a 100%)", borderColor: "#15803d", color: "#f0fdf4", boxShadow: selectedRing };
      default:
        return { background: "#475569", borderColor: "#334155", color: "#f8fafc", boxShadow: selectedRing };
    }
  }
  if (isOpenDoorCell(c)) {
    switch (getKeyIdFromCell(c)) {
      case "blue":
        return { background: "linear-gradient(135deg, #dbeafe 0%, #93c5fd 100%)", borderColor: "#3b82f6", color: "#1e3a8a", boxShadow: selectedRing };
      case "red":
        return { background: "linear-gradient(135deg, #ffe4e6 0%, #fda4af 100%)", borderColor: "#fb7185", color: "#881337", boxShadow: selectedRing };
      case "green":
        return { background: "linear-gradient(135deg, #dcfce7 0%, #86efac 100%)", borderColor: "#4ade80", color: "#14532d", boxShadow: selectedRing };
      default:
        return { background: "#e2e8f0", borderColor: "#94a3b8", color: "#334155", boxShadow: selectedRing };
    }
  }
  return { background: cellBG(c), borderColor: selected ? "#0f172a" : "#cbd5e1", color: "#0f172a", boxShadow: selectedRing };
}
