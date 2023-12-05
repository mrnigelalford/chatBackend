/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from 'openai';
import { ChatCompletionStreamParams } from "openai/lib/ChatCompletionStream";

const openai = new OpenAI();

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

export async function OpenAIStream(payload: OpenAIStreamPayload): Promise<any> {
  const stream = await openai.beta.chat.completions.stream(payload as ChatCompletionStreamParams)

  return stream.finalChatCompletion();
}