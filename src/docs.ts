import GPT3Tokenizer from "gpt3-tokenizer";
import { supabaseClient } from "./supabase";
import { OpenAIStream, OpenAIStreamPayload } from "./openAI/util";

/**
  * build an embedding using search text provided from user
  * text passed to openai embedding
  * resulting embedding is sent to supabase to match to a similar embedding (thresholds are applied and can be adjusted)
  * matching text is sent to openai with wrapping parameters to protect from hacking and streamline the input and output from openai
  * the answer is streamed back from openai to front-end.
  * model: gpt-3.5-turbo-0301
 */

const getOpenAIStream = async (query: string): Promise<ReadableStream<string>> => {
  // OpenAI recommends replacing newlines with spaces for best results
  const input = query.replace(/\n/g, " ");
  // console.log("input: ", input);

  const apiKey = process.env.OPENAI_API_KEY;

  const apiURL = process.env.OPENAI_PROXY == "" ? "https://api.openai.com" : process.env.OPENAI_PROXY;

  const embeddingResponse = await fetch(
    apiURL + "/v1/embeddings",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input,
        model: "text-embedding-ada-002"
      })
    }
  );

  const embeddingData = await embeddingResponse.json();
  const [{ embedding }] = embeddingData.data;
  const { data: documents, error } = await supabaseClient.rpc(
    "match_documents",
    {
      query_embedding: embedding,
      similarity_threshold: 0.1, // Choose an appropriate threshold for your data
      match_count: 10 // Choose the number of matches
    }
  );

  if (error) console.error('error: ', error);

  const tokenizer = new GPT3Tokenizer({ type: "gpt3" });
  let tokenCount = 0;
  let contextText = "";

  // Concat matched documents
  if (documents) {
    for (let i = 0; i < 1; i++) {
      const document = documents[i];
      const content = document.content;
      const url = document.url;
      const encoded = tokenizer.encode(content);
      tokenCount += encoded.text.length;

      // Limit context to max 1500 tokens (configurable)
      if (tokenCount > 1500) {
        break;
      }

      contextText += `${content.trim()}\nSOURCE: ${url}\n---\n`;
    }
  }
  const systemContent = `You are a helpful assistant. When given CONTEXT you answer questions using only that information, and you always format your output in markdown. You include code snippets if relevant. If you are unsure and the answer is not explicitly written in the CONTEXT provided, you say "Sorry, I don't know how to help with that."  If the CONTEXT includes source URLs include them under a SOURCES heading at the end of your response. Always include all of the relevant source urls from the CONTEXT, but never list a URL more than once (ignore trailing forward slashes when comparing for uniqueness). Never include URLs that are not in the CONTEXT sections. Never make up URLs. Do not return markdown format`;

  const assistantContent = `example text
  
  \`\`\`js
  function HomePage() {
    return <div>test</div>
  }
  
  export default HomePage
  \`\`\`
  
  SOURCES: https://test.com`;

  const userMessage = `CONTEXT:
  ${contextText}
  
  USER QUESTION: 
  ${query}  
  `;

  const messages = [
    {
      role: "system",
      content: systemContent
    },
    {
      role: "assistant",
      content: assistantContent
    },
    {
      role: "user",
      content: userMessage
    }
  ];

  const payload: OpenAIStreamPayload = {
    model: "gpt-3.5-turbo-16k",
    messages: messages,
    temperature: 0,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
    max_tokens: 2000,
    stream: true,
    n: 1
  };

  const stream = await OpenAIStream(payload);
  return stream;
};

// TODO: Create a handler for openai rate limit
// Expectation: Fallback to supabase returns

export default getOpenAIStream;