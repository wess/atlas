const base = "https://github.com/wess/atlas/releases/download";
export const releaseUrl = (name: string, version: string): string =>
  `${base}/v${version}/${name.replace(/^@/, "").replaceAll("/", "-")}-${version}.tgz`;

export const releaseVersion = (name: string, source: string): string | undefined => {
  const version = source.match(/^https:\/\/github\.com\/wess\/atlas\/releases\/download\/v(\d+\.\d+\.\d+)\//)?.[1];
  return version && source === releaseUrl(name, version) ? version : undefined;
};

export const cliCommand = (version: string): string => `bunx --package ${releaseUrl("@wess/atlas-cli", version)} atlas`;
