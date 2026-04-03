import type { PipeFn } from "../pipe/index.ts";

export const parseJson: PipeFn = async (conn) => {
  const req = conn.request;
  if (req.headers.get("content-type")?.includes("application/json")) {
    const body = await req.json();
    return { ...conn, body };
  }
  return conn;
};

export const parseForm: PipeFn = async (conn) => {
  const req = conn.request;
  if (req.headers.get("content-type")?.includes("application/x-www-form-urlencoded")) {
    const formData = await req.formData();
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
    const formData = await req.formData();
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
