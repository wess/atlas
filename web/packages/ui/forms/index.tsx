import { Button, Select, type SelectProps, TextInput, type TextInputProps } from "@mantine/core";
import { useForm } from "@mantine/form";
import type React from "react";
import type { z } from "zod";

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

    return { form, handleSubmit: form.onSubmit((values) => config.onSubmit(values as T)) };
  };
};

export type TextFieldProps = {
  form: ReturnType<typeof useForm>;
  name: string;
  label?: string;
} & Omit<TextInputProps, "form">;

export const TextField = ({ form, name, label, ...rest }: TextFieldProps) => (
  <TextInput label={label ?? name} {...form.getInputProps(name)} {...rest} />
);

export type SelectFieldProps = {
  form: ReturnType<typeof useForm>;
  name: string;
  label?: string;
  options: { value: string; label: string }[];
} & Omit<SelectProps, "form" | "data">;

export const SelectField = ({ form, name, label, options, ...rest }: SelectFieldProps) => (
  <Select label={label ?? name} data={options} {...form.getInputProps(name)} {...rest} />
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
