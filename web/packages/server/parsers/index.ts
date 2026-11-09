import { badRequest } from "../errors/index.ts";
import type { PipeFn } from "../pipe/index.ts";

const JSON_SUFFIX = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+\+json$/;

/**
 * True for application/json and any type/subtype+json, judged on the MIME
 * essence. A substring match also accepted "text/plain; x=application/json",
 * which a cross-site form can send without a CORS preflight.
 */
export const isJsonContentType = (header: string | null | undefined): boolean => {
  const essence = (header ?? "").split(";")[0]!.trim().toLowerCase();
  return essence === "application/json" || JSON_SUFFIX.test(essence);
};

export const parseJson: PipeFn = async (conn) => {
  const req = conn.request;
  if (isJsonContentType(req.headers.get("content-type"))) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      throw badRequest("Invalid JSON body");
    }
    return { ...conn, body };
  }
  return conn;
};

export const parseForm: PipeFn = async (conn) => {
  const req = conn.request;
  if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
    let formData: Awaited<ReturnType<typeof req.formData>>;
    try {
      formData = await req.formData();
    } catch {
      throw badRequest("Invalid form body");
    }
    const body: Record<string, string> = {};
    formData.forEach((v, k) => {
      if (typeof v === "string") body[k] = v;
    });
    return { ...conn, body };
  }
  return conn;
};

export const parseMultipart: PipeFn = async (conn) => {
  const req = conn.request;
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    let formData: Awaited<ReturnType<typeof req.formData>>;
    try {
      formData = await req.formData();
    } catch {
      throw badRequest("Invalid form body");
    }
    const fields: Record<string, string> = {};
    const files: Record<string, Blob> = {};
    formData.forEach((v, k) => {
      if (typeof v === "string") fields[k] = v;
      else files[k] = v;
    });
    return { ...conn, body: { fields, files } };
  }
  return conn;
};
