import { type FocusEvent, type KeyboardEvent, type MouseEvent, useId, useState } from "react";

export type Option = { value: string; label: string };
export type OptionInput = string | Option;

export const normalizeOptions = (data: readonly OptionInput[]): Option[] =>
  data.map((item) => (typeof item === "string" ? { value: item, label: item } : item));

// select-only combobox pattern: focus stays on the trigger, the active option is aria-activedescendant
export const useListbox = (options: {
  items: Option[];
  isSelected: (value: string) => boolean;
  onToggle: (value: string) => void;
  onRemoveLast?: () => void;
}) => {
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (index: number) => `${id}-option-${index}`;
  const [opened, setOpened] = useState(false);
  const [active, setActive] = useState(0);
  const last = options.items.length - 1;

  const open = (index = 0) => {
    setActive(index);
    setOpened(true);
  };
  const close = () => setOpened(false);
  const toggleActive = () => {
    const item = options.items[active];
    if (item) options.onToggle(item.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case "ArrowDown":
        if (opened) setActive(Math.min(active + 1, last));
        else open();
        break;
      case "ArrowUp":
        if (opened) setActive(Math.max(active - 1, 0));
        else open(Math.max(last, 0));
        break;
      case "Home":
        setActive(0);
        break;
      case "End":
        setActive(Math.max(last, 0));
        break;
      case "Enter":
      case " ":
        if (opened) toggleActive();
        else open();
        break;
      case "Escape":
        close();
        break;
      case "Backspace":
        options.onRemoveLast?.();
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return {
    opened,
    active,
    getTriggerProps: () => ({
      type: "button" as const,
      role: "combobox",
      "aria-haspopup": "listbox" as const,
      "aria-expanded": opened,
      "aria-controls": listId,
      "aria-activedescendant": opened && options.items[active] ? optionId(active) : undefined,
      onKeyDown,
      onBlur: (_event: FocusEvent<HTMLElement>) => close(),
      onClick: (event: MouseEvent<HTMLElement>) => {
        // safari does not focus a clicked button, and blur is what closes the list
        event.currentTarget.focus();
        if (opened) close();
        else open();
      },
    }),
    getListProps: () => ({ role: "listbox", id: listId, "aria-multiselectable": true, hidden: !opened }),
    getOptionProps: (index: number) => {
      const item = options.items[index];
      return {
        role: "option",
        id: optionId(index),
        "aria-selected": item ? options.isSelected(item.value) : false,
        "data-active": index === active ? "" : undefined,
        onMouseEnter: () => setActive(index),
        // keep focus on the trigger so choosing an option does not blur and close the list
        onMouseDown: (event: MouseEvent) => event.preventDefault(),
        onClick: () => item && options.onToggle(item.value),
      };
    },
  };
};
