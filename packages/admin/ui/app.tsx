import { AppShell, MantineProvider } from "@mantine/core";
import React, { useCallback, useEffect, useState } from "react";
import { AdminSidebar } from "./components/sidebar.tsx";
import { Create } from "./create.tsx";
import { Dashboard } from "./dashboard.tsx";
import { Detail } from "./detail.tsx";
import { ModelList } from "./list.tsx";
import { QueryBuilder } from "./query.tsx";

type SchemaModel = {
  table: string;
  columns: { name: string; type: string; primary?: boolean; nullable?: boolean; unique?: boolean }[];
  listFields?: string[];
  searchFields?: string[];
  filterFields?: string[];
  actions?: { name: string; label: string }[];
  bulkActions?: string[];
  readOnly?: boolean;
  relations?: { table: string; foreignKey: string; label?: string }[];
};

type SchemaResponse = {
  models: SchemaModel[];
};

export type AdminAppProps = {
  basePath?: string;
};

export const AdminApp = ({ basePath = "/admin" }: AdminAppProps) => {
  const [view, setView] = useState("dashboard");
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [modelCounts, setModelCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${basePath}/api/schema`);
      const data: SchemaResponse = await res.json();
      setSchema(data);

      const counts: Record<string, number> = {};
      for (const m of data.models) {
        const listRes = await fetch(`${basePath}/api/${m.table}?limit=1`);
        const listData = await listRes.json();
        counts[m.table] = listData.meta?.total ?? 0;
      }
      setModelCounts(counts);
    };
    load();
  }, [basePath]);

  const navigate = useCallback((path: string) => setView(path), []);

  if (!schema) return null;

  const activeKey =
    view === "dashboard"
      ? "dashboard"
      : view === "query"
        ? "query"
        : view.startsWith("list/")
          ? view.replace("list/", "")
          : view.startsWith("detail/")
            ? view.split("/")[1]
            : view.startsWith("create/")
              ? view.split("/")[1]
              : "";

  const renderContent = () => {
    if (view === "dashboard") {
      return (
        <Dashboard
          models={schema.models.map((m) => ({ table: m.table, count: modelCounts[m.table] ?? 0 }))}
          onNavigate={navigate}
        />
      );
    }

    if (view === "query") {
      return <QueryBuilder models={schema.models} basePath={basePath} />;
    }

    if (view.startsWith("list/")) {
      const table = view.replace("list/", "");
      const model = schema.models.find((m) => m.table === table);
      if (!model) return null;
      return <ModelList table={table} schema={model} basePath={basePath} onNavigate={navigate} />;
    }

    if (view.startsWith("detail/")) {
      const parts = view.split("/");
      const table = parts[1]!;
      const id = parts[2]!;
      const model = schema.models.find((m) => m.table === table);
      if (!model) return null;
      return <Detail table={table} id={id} schema={model} basePath={basePath} onNavigate={navigate} />;
    }

    if (view.startsWith("create/")) {
      const table = view.replace("create/", "");
      const model = schema.models.find((m) => m.table === table);
      if (!model) return null;
      return <Create table={table} schema={model} basePath={basePath} onNavigate={navigate} />;
    }

    return null;
  };

  return (
    <MantineProvider>
      <AppShell navbar={{ width: 250, breakpoint: "sm" }} padding="md">
        <AppShell.Navbar>
          <AdminSidebar
            models={schema.models.map((m) => ({ table: m.table }))}
            active={activeKey}
            basePath={basePath}
            onNavigate={navigate}
          />
        </AppShell.Navbar>
        <AppShell.Main>{renderContent()}</AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
};
