export type Store = {
  readonly endpoint: string;
  readonly bucket: string;
  readonly accessKey: string;
  readonly secretKey: string;
  readonly region: string;
};

export const createStore = (opts: {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region?: string;
}): Store => ({
  endpoint: opts.endpoint.replace(/\/+$/, ""),
  bucket: opts.bucket,
  accessKey: opts.accessKey,
  secretKey: opts.secretKey,
  region: opts.region ?? "us-east-1",
});
