import { expect, test } from "bun:test";
import { renderToStaticMarkup as html } from "react-dom/server";
import * as components from "../components/index.tsx";

const {
  ActionIcon,
  Alert,
  AppShell,
  Badge,
  Breadcrumbs,
  Button,
  Checkbox,
  Code,
  Collapse,
  Loader,
  MultiSelect,
  NavLink,
  NumberInput,
  Pagination,
  PasswordInput,
  Select,
  SimpleGrid,
  Table,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Title,
} = components;

test("Button defaults to a non-submitting button and reflects its variants", () => {
  const out = html(
    <Button color="danger" variant="light" size="xs">
      Go
    </Button>,
  );
  expect(out).toContain('type="button"');
  expect(out).toContain('data-color="danger"');
  expect(out).toContain('data-variant="light"');
  expect(out).toContain('data-size="xs"');
  expect(out).toContain("<span>Go</span>");
});

test("a loading Button is disabled, busy, and swaps its icon for the loader", () => {
  const out = html(
    <Button loading leftSection={<i id="icon" />}>
      Go
    </Button>,
  );
  expect(out).toContain("disabled");
  expect(out).toContain('aria-busy="true"');
  expect(out).toContain("atlas-loader");
  expect(out).not.toContain('id="icon"');
});

test("ActionIcon carries its required accessible name", () => {
  expect(html(<ActionIcon aria-label="Remove">x</ActionIcon>)).toContain('aria-label="Remove"');
});

test("Title maps order to the heading level", () => {
  expect(html(<Title order={3}>T</Title>)).toContain("<h3");
  expect(html(<Title>T</Title>)).toContain("<h1");
});

test("Text keeps tone, weight and transform props off the dom", () => {
  const out = html(
    <Text c="dimmed" fw={500} tt="capitalize" size="sm" truncate>
      T
    </Text>,
  );
  expect(out).toContain('data-c="dimmed"');
  expect(out).toContain("font-weight:500");
  expect(out).toContain("text-transform:capitalize");
  expect(out).toContain("data-truncate");
});

test("Alert announces itself and Badge renders inline", () => {
  expect(html(<Alert color="danger">No</Alert>)).toContain('role="alert"');
  expect(html(<Badge>1</Badge>)).toContain("<span");
});

test("Loader exposes status and renders dots only for that type", () => {
  expect(html(<Loader />)).toContain('role="status"');
  expect(html(<Loader />)).not.toContain("<i>");
  expect(html(<Loader type="dots" />)).toContain("<i>");
});

test("TextInput puts layout on the root and native props on the input", () => {
  const out = html(<TextInput label="Email" type="email" flex={1} leftSection={<i />} placeholder="you@example.com" />);
  expect(out).toMatch(/<div class="atlas-field atlas-textinput"[^>]*style="flex:1"/);
  expect(out).toMatch(/<input type="email"[^>]*placeholder="you@example.com"/);
  expect(out).toContain('data-side="left"');
});

test("PasswordInput starts hidden with a labelled toggle", () => {
  const out = html(<PasswordInput label="Password" />);
  expect(out).toContain('type="password"');
  expect(out).toContain('aria-label="Show password"');
});

test("NumberInput is numeric and accepts decimals", () => {
  const out = html(<NumberInput label="Limit" value={5} min={1} max={9} onChange={() => {}} />);
  expect(out).toContain('type="number"');
  expect(out).toContain('step="any"');
  expect(out).toContain('min="1"');
});

test("Textarea exposes row limits to css when autosizing", () => {
  const out = html(<Textarea autosize minRows={2} maxRows={4} />);
  expect(out).toContain("data-autosize");
  expect(out).toContain("--rows-max:4");
});

test("Select takes strings or pairs, and only offers an empty choice when clearable", () => {
  const required = html(<Select data={["a", { value: "b", label: "Bee" }]} value="a" onChange={() => {}} />);
  expect(required).toContain('<option value="a"');
  expect(required).toContain(">Bee</option>");
  expect(required).not.toContain('<option value=""');
  const clearable = html(<Select data={["a"]} value="a" clearable onChange={() => {}} />);
  expect(clearable).toContain('<option value=""');
});

test("MultiSelect shows chosen labels, or the placeholder when nothing is chosen", () => {
  const chosen = html(<MultiSelect label="Cols" data={[{ value: "a", label: "Alpha" }]} value={["a"]} />);
  expect(chosen).toContain("atlas-multiselect__pill");
  expect(chosen).toContain('role="combobox"');
  const none = html(<MultiSelect data={["a"]} value={[]} placeholder="All columns" />);
  expect(none).toContain("All columns");
});

test("NavLink is a link with a destination and a button without one", () => {
  expect(html(<NavLink label="A" href="/a" active />)).toMatch(/<a [^>]*aria-current="page"/);
  const action = html(<NavLink label="A" />);
  expect(action).toContain("<button");
  expect(action).toContain('type="button"');
});

test("Pagination marks the current page and disables the dead end", () => {
  const out = html(<Pagination total={20} value={1} onChange={() => {}} />);
  expect(out).toContain('aria-current="page"');
  expect(out).toMatch(/aria-label="Previous page" disabled/);
  expect(out).toContain("…");
});

test("Checkbox renders its label around a native input", () => {
  const out = html(<Checkbox label="Active" checked onChange={() => {}} />);
  expect(out).toMatch(/<label[^>]*><input type="checkbox"/);
  expect(out).toContain("Active");
});

test("Collapse makes collapsed content inert", () => {
  expect(html(<Collapse expanded={false}>x</Collapse>)).toContain("inert");
  expect(html(<Collapse expanded>x</Collapse>)).not.toContain("inert");
});

test("Code renders block and inline forms", () => {
  expect(html(<Code block>x</Code>)).toContain("<pre");
  expect(html(<Code>x</Code>)).not.toContain("<pre");
});

test("SimpleGrid falls back through its breakpoints", () => {
  const out = html(<SimpleGrid cols={{ base: 1, sm: 2 }} />);
  expect(out).toContain("--cols:1");
  expect(out).toContain("--cols-sm:2");
  expect(out).toContain("--cols-lg:2");
});

test("Table keeps native children and reflects its flags", () => {
  const out = html(
    <Table striped>
      <tbody>
        <tr>
          <td>x</td>
        </tr>
      </tbody>
    </Table>,
  );
  expect(out).toContain("data-striped");
  expect(out).toContain("<td>x</td>");
});

test("AppShell and Breadcrumbs render their landmarks", () => {
  expect(
    html(
      <AppShell>
        <AppShell.Navbar>n</AppShell.Navbar>
        <AppShell.Main>m</AppShell.Main>
      </AppShell>,
    ),
  ).toContain("<main");
  expect(
    html(
      <Breadcrumbs>
        <span>a</span>
        <span>b</span>
      </Breadcrumbs>,
    ),
  ).toContain('aria-label="Breadcrumb"');
});

test("Tabs hides inactive panels and wires tab to panel", () => {
  const out = html(
    <Tabs defaultValue="one">
      <Tabs.List>
        <Tabs.Tab value="one">One</Tabs.Tab>
        <Tabs.Tab value="two">Two</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="one" pt="md">
        first
      </Tabs.Panel>
      <Tabs.Panel value="two">second</Tabs.Panel>
    </Tabs>,
  );
  expect(out).toContain('aria-selected="true"');
  expect(out).toContain('tabindex="-1"');
  expect(out).toMatch(/hidden=""[^>]*>second/);
  expect(out).toContain("padding-top:var(--atlas-space-md)");
});

test("a Tabs part outside Tabs fails loudly", () => {
  expect(() => html(<Tabs.Tab value="x" />)).toThrow("inside <Tabs>");
});
