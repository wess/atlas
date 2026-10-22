import { badRequest } from "../errors/index.ts";
import type { PipeFn } from "../pipe/index.ts";

export const parseJson: PipeFn = async (conn) => {
  const req = conn.request;
  if (req.headers.get("content-type")?.includes("application/json")) {
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
