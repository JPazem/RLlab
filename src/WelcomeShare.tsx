import qrCode from "./assets/QR_Code_RLGame_Outreach.png";
import type { AppLanguage } from "./LanguageToggle";

const TEXT = {
  en: { title: "Play on your own", scan: "Scan to open the academy on your phone.", alt: "QR code to open the Detective Academy" },
  de: { title: "Spiele selbst", scan: "Scanne den Code und öffne die Akademie auf deinem Handy.", alt: "QR-Code zum Öffnen der Detektivakademie" },
};

export default function WelcomeShare({ language }: { language: AppLanguage }) {
  const text = TEXT[language];
  return <aside className="welcome-share">
    <img src={qrCode} alt={text.alt} />
    <div><strong>{text.title}</strong><p>{text.scan}</p></div>
  </aside>;
}
