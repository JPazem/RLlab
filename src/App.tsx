import './App.css'
import InteractiveRLLab from './InteractiveRLLAb';
import DarkModeToggle from "./components/ui/DarkModeToggle";

export default function App() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 text-black dark:text-slate-100 transition-colors">
      <div className="p-3 flex justify-end">
        <DarkModeToggle />
      </div>

      <InteractiveRLLab />
    </div>
  );
}
