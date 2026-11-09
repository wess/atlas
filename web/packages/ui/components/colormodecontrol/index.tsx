import { Monitor, Moon, Sun } from "lucide-react";
import type { ComponentProps } from "react";
import { component } from "../../factory/index.tsx";
import { type ColorMode, useColorMode } from "../../headless/index.tsx";

const Base = component({ name: "colormodecontrol", element: "fieldset" });

const choices: { mode: ColorMode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "system", label: "System", Icon: Monitor },
];

// radios, so arrow keys and the checked state come from the browser
export const ColorModeControl = (props: ComponentProps<typeof Base>) => {
  const { mode, setMode } = useColorMode();
  return (
    <Base {...props}>
      <legend>Color mode</legend>
      {choices.map(({ mode: value, label, Icon }) => (
        <label key={value}>
          <input
            type="radio"
            name="atlas-color-mode"
            value={value}
            checked={mode === value}
            onChange={() => setMode(value)}
          />
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
        </label>
      ))}
    </Base>
  );
};
