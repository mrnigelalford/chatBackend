import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export interface OpenAIStreamPayload {
  model: string;
  messages: { role: string; content: string }[];
  temperature: number;
  top_p: number;
  frequency_penalty: number;
  presence_penalty: number;
  max_tokens: number;
  stream: boolean;
  n: number;
}

export async function OpenAIStream(payload: OpenAIStreamPayload): Promise<ReadableStream<Uint8Array>> {
  const apiURL = process.env.OPENAI_PROXY === "" ? "https://api.openai.com" : process.env.OPENAI_PROXY;

  const res = await fetch(`${apiURL}/v1/chat/completions`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    },
    method: "POST",
    body: JSON.stringify(payload),
  });

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const content = json.choices[0].delta.content;
            const queue = encoder.encode(content);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }
        }
      };

      const parser = createParser(onParse);

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      for await (const chunk of res.body) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
}
