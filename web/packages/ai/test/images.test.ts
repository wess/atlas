import { expect, test } from "bun:test";
import { createProvider, type ProviderConfig } from "../provider/index.ts";

test("image attachments reach each transport in chat and streaming requests", async () => {
  const original = globalThis.fetch;
  const requests: Record<string, any>[] = [];
  globalThis.fetch = (async (_input: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    requests.push(body);
    if (body.stream) return new Response("");
    return Response.json({
      choices: [{ message: { content: "ready" } }],
      content: [{ type: "text", text: "ready" }],
      message: { content: "ready" },
      model: "test",
    });
  }) as typeof fetch;
  try {
    const configs: ProviderConfig[] = [
      { provider: "openai", key: "test" },
      { provider: "anthropic", key: "test" },
      { provider: "ollama" },
    ];
    for (const config of configs) {
      const provider = createProvider(config);
      const options = {
        messages: [
          {
            role: "user" as const,
            content: "What is here?",
            images: [{ mediaType: "image/jpeg" as const, data: "aW1hZ2U=" }],
          },
        ],
      };
      await provider.chat(options);
      for await (const _chunk of provider.chatStream(options)) {
        /* consume the stream */
      }
      const chat = requests.shift()!;
      const stream = requests.shift()!;
      expect(stream.messages).toEqual(chat.messages);
      const message = chat.messages[0];
      if (config.provider === "openai")
        expect(message.content[1]).toEqual({
          type: "image_url",
          image_url: { url: "data:image/jpeg;base64,aW1hZ2U=" },
        });
      else if (config.provider === "anthropic")
        expect(message.content[0]).toEqual({
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: "aW1hZ2U=" },
        });
      else expect(message.images).toEqual(["aW1hZ2U="]);
      await expect(
        provider.chat({ messages: [{ role: "system", content: "", images: options.messages[0]!.images }] }),
      ).rejects.toThrow("user messages");
      await expect(
        provider.chat({
          messages: [
            {
              role: "user",
              content: "",
              images: [{ mediaType: "image/png", data: "https://example.invalid/image.png" }],
            },
          ],
        }),
      ).rejects.toThrow("base64");
      expect(requests).toHaveLength(0);
    }
  } finally {
    globalThis.fetch = original;
  }
});
