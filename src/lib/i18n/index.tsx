"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { ja } from "./ja";
import { en } from "./en";
import type { TranslationShape } from "./ja";

export type Locale = "ja" | "en";

type Params = Record<string, string | number>;

function interpolate(str: string, params?: Params): string {
  if (!params) return str;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, "g"), String(v)),
    str
  );
}

function getNestedValue(obj: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}

const dictionaries: Record<Locale, TranslationShape> = { ja, en };

interface LocaleContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Params) => string;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: "ja",
  setLocale: () => {},
  t: (key) => key,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  // SSRと初回クライアントレンダーを一致させるため必ず "ja" で開始し、
  // 保存済みロケールはマウント後に反映する (hydration mismatch 対策)
  const [locale, setLocaleState] = useState<Locale>("ja");

  useEffect(() => {
    const saved = localStorage.getItem("meshimatch_locale");
    if (saved === "en" || saved === "ja") {
      // hydration mismatch を避けるにはマウント後の反映が必要 (再レンダー1回は意図的)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") {
      localStorage.setItem("meshimatch_locale", l);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Params): string => {
      const dict = dictionaries[locale] as unknown as Record<string, unknown>;
      const value = getNestedValue(dict, key);
      return interpolate(value, params);
    },
    [locale]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}
