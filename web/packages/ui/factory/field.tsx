import type { ReactNode } from "react";
import { type ControlProps, useField } from "../headless/field.ts";
import { cx, type Size, type SystemProps, splitSystem } from "./system.ts";

export type FieldProps = SystemProps & {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  leftSection?: ReactNode;
  rightSection?: ReactNode;
  size?: Size;
  id?: string;
  className?: string;
  style?: React.CSSProperties;
};

const fieldKeys = new Set([
  "label",
  "description",
  "error",
  "required",
  "leftSection",
  "rightSection",
  "size",
  "id",
  "className",
  "style",
]);

// the kind names the root class; render receives wired-up control props and everything unclaimed
export const createField = <P extends object>(kind: string, render: (control: ControlProps, props: P) => ReactNode) => {
  return (props: FieldProps & Omit<P, keyof FieldProps>) => {
    const own: Record<string, any> = {};
    const others: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(props)) (fieldKeys.has(key) ? own : others)[key] = value;
    const { system, rest } = splitSystem(others);
    const { control, descriptionProps, errorProps } = useField({
      id: own.id,
      required: own.required,
      hasError: Boolean(own.error),
      hasDescription: Boolean(own.description),
    });
    return (
      <div
        className={cx("atlas-field", `atlas-${kind}`, own.className)}
        data-size={own.size ?? "sm"}
        data-invalid={own.error ? "" : undefined}
        style={{ ...system, ...own.style }}
      >
        {own.label && (
          <label className="atlas-field__label" htmlFor={control.id}>
            {own.label}
            {own.required && <span aria-hidden="true"> *</span>}
          </label>
        )}
        {own.description && (
          <p className="atlas-field__description" {...descriptionProps}>
            {own.description}
          </p>
        )}
        <div className="atlas-field__control">
          {own.leftSection && (
            <span className="atlas-field__section" data-side="left">
              {own.leftSection}
            </span>
          )}
          {render(control, rest as P)}
          {own.rightSection && (
            <span className="atlas-field__section" data-side="right">
              {own.rightSection}
            </span>
          )}
        </div>
        {own.error && (
          <p className="atlas-field__error" {...errorProps}>
            {own.error}
          </p>
        )}
      </div>
    );
  };
};
