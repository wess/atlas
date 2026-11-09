import { createRoot } from "react-dom/client";
import { AdminApp } from "./app.tsx";
import "@atlas/ui/styles.css";

const element = document.getElementById("root")!;
createRoot(element).render(<AdminApp basePath={element.dataset.basePath} />);
