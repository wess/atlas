import { LoginPage } from "@atlas/ui/auth";
import { Alert, AppShell, Button, Stack, Text, Title } from "@atlas/ui/components";
import { navigate, useLocation } from "@atlas/ui/headless";
import { AtlasProvider } from "@atlas/ui/provider";
import { useCallback, useEffect, useState } from "react";
import { adminFetch, signedOutEvent } from "./api.ts";
import { AdminSidebar } from "./components/sidebar.tsx";
import { Create } from "./create.tsx";
import { Dashboard } from "./dashboard.tsx";
import { Detail } from "./detail.tsx";
import { ModelList } from "./list.tsx";
import { hrefFor, parseRoute, paths } from "./paths.ts";
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

type Session = { authRequired: boolean; authenticated: boolean; loginEnabled: boolean };

export const AdminApp = ({ basePath = "/admin" }: AdminAppProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [schema, setSchema] = useState<SchemaResponse | null>(null);
  const [failure, setFailure] = useState<number | null>(null);
  const [modelCounts, setModelCounts] = useState<Record<string, number>>({});
  const { pathname, search } = useLocation();
  const route = parseRoute(pathname, basePath);
  const signedIn = session ? !session.authRequired || session.authenticated : false;
  const known = session !== null;

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${basePath}/session`);
      if (res.ok) setSession(await res.json());
      else setFailure(res.status);
    };
    load();
  }, [basePath]);

  useEffect(() => {
    const expire = () => setSession((current) => current && { ...current, authenticated: false });
    window.addEventListener(signedOutEvent, expire);
    return () => window.removeEventListener(signedOutEvent, expire);
  }, []);

  // sign-in keeps the address the visitor asked for, and only ever returns inside this admin
  const atLogin = route.name === "login";
  useEffect(() => {
    if (!known) return;
    if (!signedIn && !atLogin) {
      const next = encodeURIComponent(`${pathname}${search}`);
      navigate(`${hrefFor(basePath, paths.login)}?next=${next}`, { replace: true });
    } else if (signedIn && atLogin) {
      const next = new URLSearchParams(search).get("next");
      const safe = next && (next === basePath || next.startsWith(`${basePath}/`)) && !next.startsWith("//");
      navigate(safe ? next : hrefFor(basePath, paths.dashboard), { replace: true });
    }
  }, [known, signedIn, atLogin, pathname, search, basePath]);

  useEffect(() => {
    if (!signedIn) return;
    const load = async () => {
      const res = await adminFetch(`${basePath}/api/schema`);
      if (res.status === 401) return;
      if (!res.ok) {
        setFailure(res.status);
        return;
      }
      setFailure(null);
      const data: SchemaResponse = await res.json();
      setSchema(data);

      const counts: Record<string, number> = {};
      for (const m of data.models) {
        const listRes = await adminFetch(`${basePath}/api/${m.table}?limit=1`);
        const listData = await listRes.json();
        counts[m.table] = listData.meta?.total ?? 0;
      }
      setModelCounts(counts);
    };
    load();
  }, [basePath, signedIn]);

  const go = useCallback((path: string) => navigate(hrefFor(basePath, path)), [basePath]);

  const signIn = async (credentials: Record<string, string>) => {
    const res = await fetch(`${basePath}/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(credentials),
    });
    if (res.ok) {
      setSession((current) => current && { ...current, authenticated: true });
      return undefined;
    }
    const body = await res.json().catch(() => ({}));
    return { error: body.error ?? `Sign-in failed (HTTP ${res.status}). Try again.` };
  };

  const signOut = async () => {
    await fetch(`${basePath}/session`, { method: "DELETE" });
    setSession((current) => current && { ...current, authenticated: false });
    setSchema(null);
  };

  if (failure) {
    return (
      <Alert color="danger" mt="md" mx="md">
        {failure === 403
          ? "This account doesn't have access to the admin. Sign in with an administrator account and reload this page."
          : `The admin could not load (HTTP ${failure}). Check the server log, then reload this page.`}
      </Alert>
    );
  }

  if (!session) return null;

  if (!signedIn) {
    if (!atLogin) return null;
    return (
      <AtlasProvider>
        {session.loginEnabled ? (
          <LoginPage title="Sign in to the admin" onSubmit={signIn} />
        ) : (
          <Alert color="neutral" mt="md" mx="md">
            Sign-in isn't set up for this admin. Add an auth.login function to its admin() config, then restart the
            server.
          </Alert>
        )}
      </AtlasProvider>
    );
  }

  if (!schema) return null;

  const table = "table" in route ? route.table : undefined;
  const model = schema.models.find((m) => m.table === table);
  const activeKey = route.name === "dashboard" || route.name === "query" ? route.name : (table ?? "");

  const missing = (
    <Stack align="flex-start">
      <Title order={2}>Page not found</Title>
      <Text c="dimmed">Nothing in the admin lives at this address.</Text>
      <Button onClick={() => go(paths.dashboard)}>Go to the dashboard</Button>
    </Stack>
  );

  const renderContent = () => {
    switch (route.name) {
      case "dashboard":
        return (
          <Dashboard
            models={schema.models.map((m) => ({ table: m.table, count: modelCounts[m.table] ?? 0 }))}
            basePath={basePath}
            onNavigate={go}
          />
        );
      case "query":
        return <QueryBuilder models={schema.models} basePath={basePath} />;
      case "list":
        return (
          model && (
            <ModelList key={route.table} table={route.table} schema={model} basePath={basePath} onNavigate={go} />
          )
        );
      case "detail":
        return (
          model && (
            <Detail
              key={`${route.table}/${route.id}`}
              table={route.table}
              id={route.id}
              schema={model}
              basePath={basePath}
              onNavigate={go}
            />
          )
        );
      case "create":
        return (
          model && <Create key={route.table} table={route.table} schema={model} basePath={basePath} onNavigate={go} />
        );
      default:
        return null;
    }
  };

  return (
    <AtlasProvider>
      <AppShell>
        <AppShell.Navbar>
          <AdminSidebar
            models={schema.models.map((m) => ({ table: m.table }))}
            active={activeKey}
            basePath={basePath}
            onNavigate={go}
            onSignOut={session.authRequired ? signOut : undefined}
          />
        </AppShell.Navbar>
        <AppShell.Main p="md">{renderContent() || missing}</AppShell.Main>
      </AppShell>
    </AtlasProvider>
  );
};
