import { AppShell as MantineAppShell, MantineProvider, type MantineThemeOverride } from "@mantine/core";
import type React from "react";

export type AtlasProviderProps = {
  theme?: MantineThemeOverride;
  children: React.ReactNode;
};

export const AtlasProvider = ({ theme, children }: AtlasProviderProps) => (
  <MantineProvider theme={theme}>{children}</MantineProvider>
);

export type AppShellProps = {
  nav?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
};

export const AppShell = ({ nav, header, children }: AppShellProps) => (
  <MantineAppShell
    navbar={nav ? { width: 250, breakpoint: "sm" } : undefined}
    header={header ? { height: 60 } : undefined}
  >
    {header && <MantineAppShell.Header>{header}</MantineAppShell.Header>}
    {nav && <MantineAppShell.Navbar>{nav}</MantineAppShell.Navbar>}
    <MantineAppShell.Main>{children}</MantineAppShell.Main>
  </MantineAppShell>
);
