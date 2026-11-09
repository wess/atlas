// scss is a source format: dev compiles through this plugin, releases ship the css
import type { BunPlugin } from "bun";
import { compile } from "sass";

export const compileStyles = (path: string): string => compile(path, { style: "compressed" }).css;

export default {
  name: "atlas-sass",
  setup(build) {
    build.onLoad({ filter: /\.scss$/ }, (args) => ({ contents: compile(args.path).css, loader: "css" }));
  },
} satisfies BunPlugin;
