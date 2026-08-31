import type { Client } from "../client/index.ts";
import { createClient } from "../client/index.ts";

export const github = (opts: { token: string }): Client =>
  createClient({
    baseUrl: "https://api.github.com",
    headers: {
      authorization: `token ${opts.token}`,
      accept: "application/vnd.github.v3+json",
    },
  });

export const stripe = (opts: { key: string }): Client =>
  createClient({
    baseUrl: "https://api.stripe.com/v1",
    headers: {
      authorization: `Bearer ${opts.key}`,
    },
  });

export const openai = (opts: { key: string }): Client =>
  createClient({
    baseUrl: "https://api.openai.com/v1",
    headers: {
      authorization: `Bearer ${opts.key}`,
      "content-type": "application/json",
    },
  });

export const resend = (opts: { key: string }): Client =>
  createClient({
    baseUrl: "https://api.resend.com",
    headers: {
      authorization: `Bearer ${opts.key}`,
      "content-type": "application/json",
    },
  });
