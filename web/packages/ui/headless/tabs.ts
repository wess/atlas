import { type KeyboardEvent, useId } from "react";
import { useControllable } from "./controllable.ts";

const moves: Record<string, (index: number, count: number) => number> = {
  ArrowRight: (index, count) => (index + 1) % count,
  ArrowLeft: (index, count) => (index - 1 + count) % count,
  Home: () => 0,
  End: (_, count) => count - 1,
};

export const useTabs = (options: {
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string | null) => void;
}) => {
  const id = useId();
  const [active, setActive] = useControllable<string | null>({
    value: options.value,
    defaultValue: options.defaultValue ?? null,
    onChange: options.onChange,
  });
  const tabId = (value: string) => `${id}-tab-${encodeURIComponent(value)}`;
  const panelId = (value: string) => `${id}-panel-${encodeURIComponent(value)}`;

  return {
    active,
    getListProps: () => ({
      role: "tablist",
      onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
        const move = moves[event.key];
        if (!move) return;
        const tabs = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
        const next = tabs[move(tabs.indexOf(document.activeElement as HTMLElement), tabs.length)];
        event.preventDefault();
        next?.focus();
        next?.click();
      },
    }),
    getTabProps: (value: string) => ({
      role: "tab",
      type: "button" as const,
      id: tabId(value),
      "aria-selected": active === value,
      "aria-controls": panelId(value),
      tabIndex: active === value ? 0 : -1,
      onClick: () => setActive(value),
    }),
    getPanelProps: (value: string) => ({
      role: "tabpanel",
      id: panelId(value),
      "aria-labelledby": tabId(value),
      hidden: active !== value,
    }),
  };
};
