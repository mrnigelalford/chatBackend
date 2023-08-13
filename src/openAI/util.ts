/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosResponse } from "axios";
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
  // Make a POST request to OpenAI's API
  const response: AxiosResponse = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    payload,
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, responseType: 'stream' }
  );

  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Callback function for parsing SSE events
      function onParse(event: ParsedEvent | ReconnectInterval) {
        if (event.type === "event") {
          const { data } = event;
          if (data === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              controller.enqueue(content);
            }
          } catch (e) {
            // Handle possible JSON parsing errors
            controller.error(e);
          }
        }
      }

      // Set up the parser for SSE
      const parser = createParser(onParse);

      // Stream response (SSE) from OpenAI may be fragmented into multiple chunks
      // Asynchronously iterate over each chunk and feed it to the parser
      for await (const chunk of response.data) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
}
