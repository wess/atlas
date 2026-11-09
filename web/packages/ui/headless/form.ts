import { useState } from "react";

export type FormErrors = Record<string, string>;

export type InputBinding = {
  value: any;
  error?: string;
  onChange: (input: unknown) => void;
};

export type FormBinding = { getInputProps: (name: string) => InputBinding };

// text inputs hand back an event, selects and number inputs hand back the value
const readInput = (input: unknown) => {
  const target = (input as { currentTarget?: { value?: unknown } } | null)?.currentTarget;
  return target && "value" in target ? target.value : input;
};

export const useForm = <T extends Record<string, unknown>>(options: {
  initialValues: T;
  validate?: (values: T) => FormErrors;
}) => {
  const [values, setValues] = useState(options.initialValues);
  const [errors, setErrors] = useState<FormErrors>({});

  const setFieldValue = (name: string, value: unknown) => {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors(({ [name]: _cleared, ...remaining }) => remaining);
  };

  const getInputProps = (name: string): InputBinding => ({
    value: values[name] ?? "",
    error: errors[name],
    onChange: (input) => setFieldValue(name, readInput(input)),
  });

  const onSubmit = (handler: (values: T) => void | Promise<void>) => (event?: { preventDefault: () => void }) => {
    event?.preventDefault();
    const found = options.validate?.(values) ?? {};
    setErrors(found);
    if (Object.keys(found).length === 0) return handler(values);
  };

  const reset = () => {
    setValues(options.initialValues);
    setErrors({});
  };

  return { values, errors, setFieldValue, getInputProps, onSubmit, reset };
};
