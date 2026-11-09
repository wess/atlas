import { afterAll, afterEach, expect, mock, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { act, type ReactNode, useState } from "react";
import type { Root } from "react-dom/client";
import { z } from "zod";
import { ChatWindow } from "../ai/index.tsx";
import {
  Checkbox,
  Collapse,
  ColorModeControl,
  MultiSelect,
  NumberInput,
  PasswordInput,
  Select,
  Tabs,
} from "../components/index.tsx";
import { createForm, SelectField, SubmitButton, TextField } from "../forms/index.tsx";
import { useDebounced } from "../headless/index.tsx";
import { AtlasProvider } from "../provider/index.tsx";

// react checks for a dom once on import, so it has to load after the dom exists
GlobalRegistrator.register();
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import("react-dom/client");

let root: Root;

afterAll(() => GlobalRegistrator.unregister());
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  localStorage.clear();
  document.documentElement.removeAttribute("data-atlas-mode");
  document.documentElement.removeAttribute("data-atlas-scheme");
});

const render = (node: ReactNode) => {
  const host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
  act(() => root.render(node));
  return host;
};
const fire = (element: Element, event: Event) => act(() => void element.dispatchEvent(event));
const click = (element: Element) => fire(element, new MouseEvent("click", { bubbles: true }));
const press = (element: Element, key: string) => fire(element, new KeyboardEvent("keydown", { key, bubbles: true }));
const type = (element: HTMLInputElement | HTMLSelectElement, value: string) => {
  const proto = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(element, value);
  fire(element, new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
};

const DemoTabs = () => (
  <Tabs defaultValue="a">
    <Tabs.List>
      <Tabs.Tab value="a">A</Tabs.Tab>
      <Tabs.Tab value="b">B</Tabs.Tab>
      <Tabs.Tab value="c">C</Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="a">pa</Tabs.Panel>
    <Tabs.Panel value="b">pb</Tabs.Panel>
    <Tabs.Panel value="c">pc</Tabs.Panel>
  </Tabs>
);
const selected = (host: Element) => host.querySelector('[role="tab"][aria-selected="true"]')!.textContent;

test("Tabs switch on click and show only the active panel", () => {
  const host = render(<DemoTabs />);
  click(host.querySelectorAll('[role="tab"]')[1]!);
  expect(selected(host)).toBe("B");
  expect(host.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')!.textContent).toBe("pb");
});

test("Tabs follow arrow keys, wrap at the ends, and honour Home and End", () => {
  const host = render(<DemoTabs />);
  const list = host.querySelector('[role="tablist"]')!;
  host.querySelector<HTMLElement>('[role="tab"]')!.focus();
  press(list, "ArrowRight");
  expect(selected(host)).toBe("B");
  expect(document.activeElement?.textContent).toBe("B");
  press(list, "End");
  expect(selected(host)).toBe("C");
  press(list, "ArrowRight");
  expect(selected(host)).toBe("A");
  press(list, "ArrowLeft");
  expect(selected(host)).toBe("C");
  press(list, "Home");
  expect(selected(host)).toBe("A");
});

const DemoMulti = ({ initial = [] as string[] }) => {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MultiSelect label="Cols" data={["a", "b", "c"]} value={value} onChange={setValue} />
      <output>{value.join(",")}</output>
    </>
  );
};

test("MultiSelect drives entirely from the keyboard", () => {
  const host = render(<DemoMulti />);
  const trigger = host.querySelector('[role="combobox"]')!;
  const list = host.querySelector('[role="listbox"]')!;
  const output = host.querySelector("output")!;
  expect(list.hasAttribute("hidden")).toBe(true);
  press(trigger, "ArrowDown");
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(list.hasAttribute("hidden")).toBe(false);
  press(trigger, "Enter");
  expect(output.textContent).toBe("a");
  press(trigger, "ArrowDown");
  press(trigger, " ");
  expect(output.textContent).toBe("a,b");
  expect(trigger.getAttribute("aria-activedescendant")).toBe(host.querySelectorAll('[role="option"]')[1]!.id);
  press(trigger, "Enter");
  expect(output.textContent).toBe("a");
  press(trigger, "Escape");
  expect(list.hasAttribute("hidden")).toBe(true);
  press(trigger, "Backspace");
  expect(output.textContent).toBe("");
});

test("MultiSelect toggles by mouse and stays open across choices", () => {
  const host = render(<DemoMulti initial={["c"]} />);
  const trigger = host.querySelector('[role="combobox"]')!;
  click(trigger);
  const options = host.querySelectorAll('[role="option"]');
  expect(options[2]!.getAttribute("aria-selected")).toBe("true");
  click(options[0]!);
  expect(host.querySelector("output")!.textContent).toBe("c,a");
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  fire(trigger, new FocusEvent("focusout", { bubbles: true }));
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("Select reports the chosen value and null when cleared", () => {
  const onChange = mock();
  const host = render(<Select data={["a", "b"]} value="a" clearable onChange={onChange} />);
  type(host.querySelector("select")!, "b");
  expect(onChange).toHaveBeenLastCalledWith("b");
  type(host.querySelector("select")!, "");
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test("NumberInput reports numbers, and an empty string when cleared", () => {
  const onChange = mock();
  const host = render(<NumberInput value={1} onChange={onChange} />);
  const input = host.querySelector("input")!;
  type(input, "2.5");
  expect(onChange).toHaveBeenLastCalledWith(2.5);
  type(input, "");
  expect(onChange).toHaveBeenLastCalledWith("");
});

test("Checkbox sets the indeterminate dom property", () => {
  const host = render(<Checkbox indeterminate checked={false} onChange={() => {}} />);
  expect(host.querySelector("input")!.indeterminate).toBe(true);
});

test("PasswordInput toggles visibility", () => {
  const host = render(<PasswordInput label="Password" />);
  const input = host.querySelector("input")!;
  expect(input.type).toBe("password");
  click(host.querySelector("button")!);
  expect(input.type).toBe("text");
  expect(host.querySelector("button")!.getAttribute("aria-pressed")).toBe("true");
});

test("Collapse removes inert when expanded", () => {
  const host = render(<Collapse expanded={false}>x</Collapse>);
  expect(host.querySelector<HTMLElement>(".atlas-collapse")!.inert).toBe(true);
  act(() => root.render(<Collapse expanded>x</Collapse>));
  expect(host.querySelector<HTMLElement>(".atlas-collapse")!.inert).toBe(false);
});

const schema = z.object({ email: z.email("Enter an email"), role: z.string() });

const DemoForm = ({ onSubmit }: { onSubmit: (values: z.infer<typeof schema>) => void }) => {
  const [useDemo] = useState(() => createForm({ schema, initial: { email: "", role: "admin" }, onSubmit }));
  const { form, handleSubmit } = useDemo();
  return (
    <form onSubmit={handleSubmit}>
      <TextField form={form} name="email" label="Email" />
      <SelectField
        form={form}
        name="role"
        options={[
          { value: "admin", label: "Admin" },
          { value: "user", label: "User" },
        ]}
      />
      <SubmitButton>Save</SubmitButton>
    </form>
  );
};

test("createForm blocks a bad submit, shows the error, clears it on edit, and submits good values", () => {
  const onSubmit = mock();
  const host = render(<DemoForm onSubmit={onSubmit} />);
  const form = host.querySelector("form")!;
  const submit = () => fire(form, new Event("submit", { bubbles: true, cancelable: true }));
  submit();
  expect(onSubmit).not.toHaveBeenCalled();
  expect(host.querySelector(".atlas-field__error")!.textContent).toBe("Enter an email");
  expect(host.querySelector("input")!.getAttribute("aria-invalid")).toBe("true");
  type(host.querySelector("input")!, "a@b.co");
  expect(host.querySelector(".atlas-field__error")).toBeNull();
  type(host.querySelector("select")!, "user");
  submit();
  expect(onSubmit).toHaveBeenCalledWith({ email: "a@b.co", role: "user" });
});

const DemoDebounced = ({ value }: { value: string }) => <output>{useDebounced(value, 10)}</output>;

test("useDebounced only settles after the delay", async () => {
  const host = render(<DemoDebounced value="a" />);
  act(() => root.render(<DemoDebounced value="b" />));
  expect(host.querySelector("output")!.textContent).toBe("a");
  await act(() => new Promise((done) => setTimeout(done, 25)));
  expect(host.querySelector("output")!.textContent).toBe("b");
});

const html = () => document.documentElement;

test("AtlasProvider defaults to nord following the system", () => {
  render(<AtlasProvider>x</AtlasProvider>);
  expect(html().getAttribute("data-atlas-scheme")).toBe("nord");
  expect(html().getAttribute("data-atlas-mode")).toBe("system");
});

test("ColorModeControl switches the document and remembers the choice", () => {
  const host = render(
    <AtlasProvider>
      <ColorModeControl />
    </AtlasProvider>,
  );
  const radios = host.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  expect(radios.length).toBe(3);
  expect(host.querySelector<HTMLInputElement>('input[value="system"]')!.checked).toBe(true);
  click(host.querySelector('input[value="dark"]')!);
  expect(html().getAttribute("data-atlas-mode")).toBe("dark");
  expect(localStorage.getItem("atlas-color-mode")).toBe("dark");
  expect(host.querySelector<HTMLInputElement>('input[value="dark"]')!.checked).toBe(true);
});

test("a stored choice beats the provider default, and junk in storage is ignored", () => {
  localStorage.setItem("atlas-color-mode", "light");
  localStorage.setItem("atlas-color-scheme", "atlas");
  render(<AtlasProvider defaultMode="dark">x</AtlasProvider>);
  expect(html().getAttribute("data-atlas-mode")).toBe("light");
  expect(html().getAttribute("data-atlas-scheme")).toBe("atlas");
  act(() => root.unmount());
  localStorage.setItem("atlas-color-mode", "chartreuse");
  render(<AtlasProvider defaultMode="dark">x</AtlasProvider>);
  expect(html().getAttribute("data-atlas-mode")).toBe("dark");
});

test("AtlasProvider honours a default scheme", () => {
  render(<AtlasProvider defaultScheme="atlas">x</AtlasProvider>);
  expect(html().getAttribute("data-atlas-scheme")).toBe("atlas");
});

test("ChatWindow scrolls for each new message and keeps identical messages", () => {
  const scrolls = mock();
  const original = HTMLElement.prototype.scrollTo;
  HTMLElement.prototype.scrollTo = scrolls as typeof original;
  const messages = [{ role: "user" as const, content: "hi" }];
  const host = render(<ChatWindow messages={messages} onSend={() => {}} />);
  const before = scrolls.mock.calls.length;
  act(() => root.render(<ChatWindow messages={[...messages, ...messages]} onSend={() => {}} />));
  expect(scrolls.mock.calls.length).toBeGreaterThan(before);
  expect(host.querySelectorAll(".atlas-message").length).toBe(2);
  HTMLElement.prototype.scrollTo = original;
});
