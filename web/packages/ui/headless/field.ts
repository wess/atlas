import { useId } from "react";

export type ControlProps = {
  id: string;
  className: string;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

export const useField = (options: { id?: string; required?: boolean; hasError: boolean; hasDescription: boolean }) => {
  const generated = useId();
  const id = options.id ?? generated;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [options.hasDescription && descriptionId, options.hasError && errorId].filter(Boolean).join(" ");
  const control: ControlProps = {
    id,
    className: "atlas-field__input",
    required: options.required,
    "aria-invalid": options.hasError ? true : undefined,
    "aria-describedby": describedBy || undefined,
  };
  return {
    control,
    descriptionProps: { id: descriptionId },
    errorProps: { id: errorId },
  };
};
