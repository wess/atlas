import type { CSSProperties, ReactNode } from "react";
import { AppShell as Shell } from "../components/appshell/index.tsx";
import { type ColorMode, ColorModeProvider, type ColorScheme } from "../headless/colormode.tsx";

// keys are token names from styles/tokens.scss without the --atlas- prefix, e.g. "primary" or "radius-md"
export type Theme = Record<string, string>;

export type AtlasProviderProps = {
  theme?: Theme;
  defaultMode?: ColorMode;
  defaultScheme?: ColorScheme;
  children: ReactNode;
};

const themeVars = (theme: Theme) =>
  Object.fromEntries(Object.entries(theme).map(([token, value]) => [`--atlas-${token}`, value])) as CSSProperties;

export const AtlasProvider = ({ theme, defaultMode, defaultScheme, children }: AtlasProviderProps) => (
  <ColorModeProvider defaultMode={defaultMode} defaultScheme={defaultScheme}>
    {theme ? (
      <div className="atlas-root" style={themeVars(theme)}>
        {children}
      </div>
    ) : (
      children
    )}
  </ColorModeProvider>
);

export type AppShellProps = {
  nav?: ReactNode;
  header?: ReactNode;
  children: ReactNode;
};

export const AppShell = ({ nav, header, children }: AppShellProps) => (
  <Shell>
    {header && <Shell.Header>{header}</Shell.Header>}
    {nav && <Shell.Navbar>{nav}</Shell.Navbar>}
    <Shell.Main>{children}</Shell.Main>
  </Shell>
);
