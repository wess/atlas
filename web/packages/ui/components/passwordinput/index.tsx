import { Eye, EyeOff } from "lucide-react";
import type { ComponentProps } from "react";
import { createField, type FieldProps } from "../../factory/index.tsx";
import { useDisclosure } from "../../headless/index.tsx";

const Base = createField<ComponentProps<"input">>("passwordinput", (control, props) => (
  <input {...control} {...props} />
));

export type PasswordInputProps = FieldProps & Omit<ComponentProps<"input">, keyof FieldProps | "type">;

export const PasswordInput = (props: PasswordInputProps) => {
  const [visible, { toggle }] = useDisclosure(false);
  const toggler = (
    <button
      type="button"
      className="atlas-passwordinput__toggle"
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      onClick={toggle}
    >
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
  return <Base {...props} type={visible ? "text" : "password"} rightSection={toggler} />;
};
