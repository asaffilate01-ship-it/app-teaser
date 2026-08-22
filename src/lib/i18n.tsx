import { createContext, useContext, useEffect, useState } from "react";
import { languages, langOrder, type Content, type Lang } from "./content";

const STORAGE_KEY = "criclume-lang";

const I18nContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Content }>({
  lang: "en",
  setLang: () => {},
  t: languages.en,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (stored && stored in languages) {
      setLang(stored);
      return;
    }
    const browser = navigator.language?.slice(0, 2).toLowerCase() as Lang;
    if (browser && langOrder.includes(browser)) setLang(browser);
  }, []);

  const change = (l: Lang) => {
    setLang(l);
    try {
      window.localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  };

  return (
    <I18nContext.Provider value={{ lang, setLang: change, t: languages[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export function LanguageSelect({ className = "" }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label="Language"
      className={`h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 ${className}`}
    >
      {langOrder.map((l) => (
        <option key={l} value={l}>
          {languages[l].langName}
        </option>
      ))}
    </select>
  );
}
