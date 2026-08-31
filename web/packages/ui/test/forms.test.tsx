import { expect, test } from "bun:test";
import { createForm, SelectField, SubmitButton, TextField } from "../forms/index.tsx";

test("createForm returns a function", () => {
  const useForm = createForm({ onSubmit: () => {} });
  expect(typeof useForm).toBe("function");
});

test("TextField is a function", () => {
  expect(typeof TextField).toBe("function");
});

test("SelectField is a function", () => {
  expect(typeof SelectField).toBe("function");
});

test("SubmitButton is a function", () => {
  expect(typeof SubmitButton).toBe("function");
});
