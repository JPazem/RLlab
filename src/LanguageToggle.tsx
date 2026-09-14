import { Languages } from "lucide-react";

export type AppLanguage = "en" | "de";

export default function LanguageToggle({
  language,
  onChange,
  className = "",
}: {
  language: AppLanguage;
  onChange: (language: AppLanguage) => void;
  className?: string;
}) {
  const label = language === "de" ? "Sprache auswählen" : "Choose language";

  return (
    <div className={`language-toggle ${className}`} role="group" aria-label={label}>
      <Languages aria-hidden="true" />
      <button
        type="button"
        className={language === "en" ? "active" : ""}
        onClick={() => onChange("en")}
        aria-pressed={language === "en"}
        title={language === "de" ? "Englisch verwenden" : "Use English"}
      >
        EN
      </button>
      <button
        type="button"
        className={language === "de" ? "active" : ""}
        onClick={() => onChange("de")}
        aria-pressed={language === "de"}
        title={language === "de" ? "Deutsch verwenden" : "Use German"}
      >
        DE
      </button>
    </div>
  );
}
