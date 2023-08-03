import GPT3Tokenizer from "gpt3-tokenizer";
import { getQuestionEmbedding, getSimilarEmbeddings, setQuestionEmbedding, updateSupabaseDoc } from "./supabase";
import { OpenAIStream, OpenAIStreamPayload } from "./openAI/util";
import { getEmbedding } from "./setEmbeddings";

const maxTokens = 2000;

/**
  * build an embedding using search text provided from user
  * text passed to openai embedding
  * resulting embedding is sent to supabase to match to a similar embedding (thresholds are applied and can be adjusted)
  * matching text is sent to openai with wrapping parameters to protect from hacking and streamline the input and output from openai
  * the answer is streamed back from openai to front-end.
  * model: gpt-3.5-turbo-0301
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

  // Build recall logic to pull previously stored embeddings and answers

  const embeddingMatch = await getSimilarEmbeddings(embedding);

  if (embeddingMatch?.gpt_response) {
    // this question has a response, use that instead of calling openai
    return embeddingMatch?.gpt_response;
  } else {

    const tokenizer = new GPT3Tokenizer({ type: "gpt3" });
    let contextText = "";

    // Use the first/highest returned doc
    if (embeddingMatch) {
      const encoded = tokenizer.encode(embeddingMatch.content);
      // Limit context to max 1500 tokens (configurable)
      if (encoded.text.length > maxTokens) {
        return 'token count exceeded';
      }

      contextText += `${embeddingMatch.content.trim()}\nSOURCE: ${embeddingMatch.url}\n---\n`;
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
    ${question}  
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
      max_tokens: maxTokens,
      stream: true,
      n: 1
    };

    const reader = (await OpenAIStream(payload)).getReader();
    let chunks;

    let done, val;
    while (!done) {
      ({ value: val, done } = await reader.read());
      if (val && val !== '') chunks += val;
    }
    const gpt_response = chunks.replace("undefined", "");
    if (embeddingMatch) await updateSupabaseDoc(gpt_response, 'documents', Number(embeddingMatch?.id));

    // TODO: return stream instead of string
    return gpt_response;
  }
};

// TODO: Create a handler for openai rate limit
// Fallback to supabase return if question has been asked

export default getOpenAIStream;