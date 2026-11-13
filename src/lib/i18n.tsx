"use client";

/**
 * Language context: picks the UI dictionary (English/Hindi), persists the
 * choice and keeps <html lang> in sync. Mount once in the root layout.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  en,
  hi,
  SERVICE_HI,
  SERVICE_DETAIL_HI,
  type Dict,
  type Lang,
} from "./strings";
import type { Service } from "./types";

const LANG_KEY = "kaamdaar.lang";

interface LangContextValue {
  lang: Lang;
  setLang: (next: Lang) => void;
  /** Current UI strings — s.nav.home etc. */
  s: Dict;
}

const LangContext = createContext<LangContextValue | null>(null);

const DICT: Record<Lang, Dict> = { en, hi };

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(LANG_KEY, next);
      document.documentElement.lang = next;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(LANG_KEY);
      if (saved === "hi" || saved === "en") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot mount hydration
        setLangState(saved);
        document.documentElement.lang = saved;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<LangContextValue>(
    () => ({ lang, setLang, s: DICT[lang] }),
    [lang, setLang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}

export interface ServiceLabels {
  name: string;
  tagline: string;
  description: string;
  includes: string[];
  excludes: string[];
  duration: string;
}

/** Hindi service text when the UI is Hindi, English seed data otherwise. */
export function useServiceLabels() {
  const { lang } = useLang();
  return useMemo(
    () =>
      (service: Service): ServiceLabels => {
        // Imported catalogue rows may contain "English / Hindi" in the
        // original name. Always render exactly one language.
        const parts = (service.name ?? "").split(/\\s+\\/\\s+/);
        const englishName = parts[0]?.trim() || service.name || "";
        const hindiName =
          SERVICE_HI[service.id]?.name ||
          service.nameHi?.trim() ||
          (parts.length > 1 ? parts.slice(1).join(" / ").trim() : "");
        const enLabels: ServiceLabels = {
          name: englishName,
          tagline: service.tagline ?? "",
          description: service.description ?? "",
          includes: service.includes ?? [],
          excludes: service.excludes ?? [],
          duration: service.duration ?? "—",
        };
        if (lang !== "hi") return enLabels;
        const detail = SERVICE_DETAIL_HI[service.id];
        if (!hindiName && !detail) return enLabels;
        return {
          ...enLabels,
          ...(hindiName ? { name: hindiName } : {}),
          ...detail,
        };
      },
    [lang],
  );
}

/** Category label in the current language, falling back to the raw value. */
export function useCatLabel() {
  const { s } = useLang();
  return (cat: string): string =>
    (s.services.cat as Record<string, string>)[cat] ?? (s.services.cat as Record<string, string>)[cat.split(/\s+\/\s+/)[0]] ?? (cat.includes(" / ") ? cat.split(/\s+\/\s+/).slice(1).join(" / ").trim() : cat);
}

/** "{n}" interpolation: t.sub.replace("{n}", "20") */
export function fill(template: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (out, [k, v]) => out.replace(`{${k}}`, String(v)),
    template,
  );
}
