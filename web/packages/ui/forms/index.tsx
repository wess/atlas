import type React from "react";
import type { z } from "zod";
import { Button, Select, TextInput } from "../components/index.tsx";
import type { FieldProps } from "../factory/index.tsx";
import { type FormBinding, useForm } from "../headless/index.tsx";

export type FormConfig<T extends Record<string, unknown>> = {
  initial?: Partial<T>;
  schema?: z.ZodType<T>;
  onSubmit: (values: T) => void | Promise<void>;
};

export const createForm = <T extends Record<string, unknown>>(config: FormConfig<T>) => {
  return () => {
    const form = useForm<T>({
      initialValues: (config.initial ?? {}) as T,
      validate: config.schema
        ? (values) => {
            const result = config.schema!.safeParse(values);
            if (result.success) return {};
            const errors: Record<string, string> = {};
            for (const issue of result.error.issues) {
              const path = issue.path.join(".");
              errors[path] = issue.message;
            }
            return errors;
          }
        : undefined,
    });

    return { form, handleSubmit: form.onSubmit((values) => config.onSubmit(values)) };
  };
};

export type TextFieldProps = FieldProps &
  Omit<React.ComponentProps<"input">, keyof FieldProps | "form" | "value" | "onChange"> & {
    form: FormBinding;
    name: string;
  };

export const TextField = ({ form, name, label, ...rest }: TextFieldProps) => (
  <TextInput name={name} label={label ?? name} {...form.getInputProps(name)} {...rest} />
);

export type SelectFieldProps = FieldProps & {
  form: FormBinding;
  name: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  clearable?: boolean;
  disabled?: boolean;
};

export const SelectField = ({ form, name, label, options, ...rest }: SelectFieldProps) => (
  <Select name={name} label={label ?? name} data={options} {...form.getInputProps(name)} {...rest} />
);

export type SubmitButtonProps = {
  children: React.ReactNode;
  loading?: boolean;
};

export const SubmitButton = ({ children, loading }: SubmitButtonProps) => (
  <Button type="submit" loading={loading}>
    {children}
  </Button>
);
