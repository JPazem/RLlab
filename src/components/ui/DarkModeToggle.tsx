import { useEffect, useState } from "react";

export default function DarkModeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="px-3 py-2 rounded-md border 
                 bg-white text-black 
                 dark:bg-slate-800 dark:text-white"
    >
      {dark ? "🌙 Dark" : "☀️ Light"}
    </button>
  );
}
