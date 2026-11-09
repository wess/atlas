import { createContext, type ReactNode, useContext, useLayoutEffect, useMemo, useState } from "react";

export const colorModes = ["light", "dark", "system"] as const;
export const colorSchemes = ["nord", "atlas"] as const;
export type ColorMode = (typeof colorModes)[number];
export type ColorScheme = (typeof colorSchemes)[number];

const modeKey = "atlas-color-mode";
const schemeKey = "atlas-color-scheme";

// storage can throw in private windows and is absent during server render
const read = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const stored = globalThis.localStorage?.getItem(key) as T | null;
    return stored && allowed.includes(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: string) => {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // the choice still applies for this visit
  }
};

export type ColorModeApi = {
  mode: ColorMode;
  scheme: ColorScheme;
  setMode: (mode: ColorMode) => void;
  setScheme: (scheme: ColorScheme) => void;
};

const ColorModeContext = createContext<ColorModeApi | null>(null);

export type ColorModeProviderProps = {
  defaultMode?: ColorMode;
  defaultScheme?: ColorScheme;
  children: ReactNode;
};

export const ColorModeProvider = ({
  defaultMode = "system",
  defaultScheme = "nord",
  children,
}: ColorModeProviderProps) => {
  const [mode, setModeState] = useState(() => read(modeKey, colorModes, defaultMode));
  const [scheme, setSchemeState] = useState(() => read(schemeKey, colorSchemes, defaultScheme));

  // scss keys every palette off these two attributes. layout effect so a saved choice lands before
  // first paint: a plain effect flashes the os palette through the button transitions
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-atlas-mode", mode);
    document.documentElement.setAttribute("data-atlas-scheme", scheme);
  }, [mode, scheme]);

  const api = useMemo<ColorModeApi>(
    () => ({
      mode,
      scheme,
      setMode: (next) => {
        write(modeKey, next);
        setModeState(next);
      },
      setScheme: (next) => {
        write(schemeKey, next);
        setSchemeState(next);
      },
    }),
    [mode, scheme],
  );

  return <ColorModeContext.Provider value={api}>{children}</ColorModeContext.Provider>;
};

export const useColorMode = () => {
  const api = useContext(ColorModeContext);
  if (!api) throw new Error("useColorMode needs <AtlasProvider> or <ColorModeProvider> above it");
  return api;
};
