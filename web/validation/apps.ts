import { resolve } from "node:path";

export type Consumer = { name: string; path: string; package: string };

export const portfolio = resolve(import.meta.dir, "../../..");
export const consumers: Consumer[] = [
  { name: "cubeplane", path: "cubeplane", package: "web" },
  { name: "openvendor", path: "openvendor", package: "." },
  { name: "billing", path: "billing", package: "." },
  { name: "lacey", path: "lacey/recipes", package: "web" },
  { name: "klatch", path: "klatch", package: "web" },
  { name: "bypath", path: "bypath", package: "web" },
  { name: "pluck", path: "pluck", package: "web" },
  { name: "standinghere", path: "standinghere", package: "web" },
  { name: "stohr", path: "stohr", package: "." },
  { name: "inkling", path: "inkling", package: "." },
  { name: "corsair", path: "corsair", package: "." },
];
