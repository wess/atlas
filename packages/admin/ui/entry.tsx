import React from "react";
import { createRoot } from "react-dom/client";
import { AdminApp } from "./app.tsx";
import "@mantine/core/styles.css";

const root = createRoot(document.getElementById("root")!);
root.render(<AdminApp />);
