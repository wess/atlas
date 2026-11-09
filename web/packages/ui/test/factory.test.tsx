import { expect, test } from "bun:test";
import { renderToStaticMarkup as html } from "react-dom/server";
import { component, compound, createField, sizes } from "../factory/index.tsx";

const Box = component({
  name: "box",
  variants: { size: sizes, framed: true },
  defaults: { size: "md" },
});

test("the name becomes the class and caller classes are kept", () => {
  expect(html(<Box className="mine" />)).toContain('class="atlas-box mine"');
});

test("variants land on data attributes instead of the dom prop", () => {
  const out = html(<Box size="lg" framed />);
  expect(out).toContain('data-size="lg"');
  expect(out).toContain('data-framed=""');
  expect(out).not.toContain(" framed=");
  expect(out).not.toContain(" size=");
});

test("defaults apply until overridden and false flags are omitted", () => {
  expect(html(<Box framed={false} />)).toBe('<div class="atlas-box" data-size="md"></div>');
});

test("system props resolve tokens and numbers into style", () => {
  const out = html(<Box p="md" mb={8} maw="75%" fw={600} />);
  expect(out).toContain("padding:var(--atlas-space-md)");
  expect(out).toContain("margin-bottom:8px");
  expect(out).toContain("max-width:75%");
  expect(out).toContain("font-weight:600");
  expect(out).not.toContain(" p=");
});

test("an explicit style wins over a system prop", () => {
  expect(html(<Box p="md" style={{ padding: 1 }} />)).toContain("padding:1px");
});

test("as swaps the rendered element and native props pass through", () => {
  expect(html(<Box as="section" id="x" />)).toBe('<section class="atlas-box" data-size="md" id="x"></section>');
});

test("compound attaches parts to the root", () => {
  const Shell = compound(Box, { Part: component({ name: "box__part" }) });
  expect(html(<Shell.Part />)).toContain("atlas-box__part");
  expect(html(<Shell />)).toContain("atlas-box");
});

test("createField wires label, error and description to the control", () => {
  const Field = createField<{ placeholder?: string }>("demo", (control, props) => <input {...control} {...props} />);
  const out = html(
    <Field id="f" label="Name" description="Shown publicly" error="Required" required placeholder="p" />,
  );
  expect(out).toContain('for="f"');
  expect(out).toContain('id="f"');
  expect(out).toContain('aria-invalid="true"');
  expect(out).toContain('aria-describedby="f-description f-error"');
  expect(out).toContain('placeholder="p"');
  expect(out).toContain("atlas-demo");
  expect(out).toContain("data-invalid");
});
