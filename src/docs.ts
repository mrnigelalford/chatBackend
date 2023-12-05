import { getQuestionEmbedding, getSimilarEmbeddings, setQuestionEmbedding, updateSupabaseDoc } from "./supabase.js";
import { getEmbedding } from "./setEmbeddings.js";
import OpenAI from 'openai';
import { ChatCompletionStreamParams } from "openai/lib/ChatCompletionStream";

const openai = new OpenAI();

const maxTokens = 2000;

/**
 * Build an embedding using the search text provided from the user.
 * Text is passed to OpenAI embedding API, and the resulting embedding is sent to Supabase to match to a similar embedding.
 * Matching text is sent to OpenAI with wrapping parameters to protect from hacking and streamline the input and output from OpenAI.
 * The answer is streamed back from OpenAI to the front-end.
 * @param {string} question - The user's question.
 * @param {string} projectID - The project ID for storing embeddings and responses.
 * @returns {Promise<string>} - The response from OpenAI.
 */
const getOpenAIStream = async (question: string, projectID: string): Promise<string> => {
  // OpenAI recommends replacing newlines with spaces for best results
  const storedEmbedding = await getQuestionEmbedding(question, `${projectID}_questions`);
  let embedding;

  // previously stored question was found
  // use this embedding instead of calling chatgpt
  if (storedEmbedding?.embedding) {
    embedding = storedEmbedding.embedding;
  } else {
    embedding = await getEmbedding(question.replace(/\n/g, " "));
    await setQuestionEmbedding({ question, embedding, location: `${projectID}_questions` });
  }

  const embeddingMatch = await getSimilarEmbeddings(embedding, projectID);

  if (embeddingMatch?.gpt_response) {
    // this question has a response, use that instead of calling openai
    return embeddingMatch.gpt_response;
  } else {
    let contextText = "";

    // Use the first/highest returned doc

      contextText += `${embeddingMatch.content.trim()}\nSOURCE: ${embeddingMatch.url}\n---\n`;

    const systemContent = `Using CONTEXT, answer in markdown. Include code when needed. If unsure, state "Sorry, I don't know how to help with that." List unique URLs from CONTEXT under 'SOURCES' on separate lines. Avoid duplicate or invented URLs. Limit response to 65 words.`;

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
    ${question}`;

    const messages = [
      {
        role: "system",
        content: systemContent,
      },
      {
        role: "assistant",
        content: assistantContent,
      },
      {
        role: "user",
        content: userMessage,
      },
    ];

    const payload = {
      model: process.env.DEFAULT_MODEL,
      messages: messages,
      temperature: 0,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      max_tokens: maxTokens,
      stream: true,
      n: 1,
    };

    const gpt_response =  await openai.beta.chat.completions.stream(payload as ChatCompletionStreamParams).finalChatCompletion();
    console.log('gptr: ', gpt_response);
    if (embeddingMatch) await updateSupabaseDoc(gpt_response, `${projectID}_documents`, Number(embeddingMatch?.id));

    // TODO: return stream instead of string
    return gpt_response as unknown as string;
  }
};

// TODO: Create a handler for openai rate limit
// Fallback to supabase return if question has been asked

export default getOpenAIStream;
