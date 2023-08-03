import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { saveToSupabase } from "./supabase";


async function scrapeAndEmbed(docURLs: any[]) {
  console.log('docURLS: ', docURLs.length);
  const documents = await getDocuments(docURLs);

  for (const { url, body } of documents) {
    const input = body.replace(/\n/g, " ");
    const apiKey = process.env.OPENAI_API_KEY;
    const apiURL = process.env.OPENAI_PROXY || "https://api.openai.com";
    const embedding = await getEmbedding(apiURL, apiKey as string, input);
    await saveToSupabase(url, input, embedding);
  }
}

// Fetch Embedding
async function getEmbedding(apiURL: string, apiKey: string, input: any) {
  const embeddingResponse = await fetch(
    `${apiURL}/v1/embeddings`,
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
  return embedding;
}

// Set a limit of 10 concurrent promises
const limit = pLimit(10);

async function getDocuments(urls: string[]) {
  const tasks = urls.map((url) => limit(() => fetchDocuments(url)));

  // Now, no more than 10 promises will be run at once.
  const allDocuments = await Promise.all(tasks);

  return allDocuments.flat();
}

async function fetchDocuments(url: string) {
  const splashUrl = process.env.SPLASH_URL;
  const fetchURL = splashUrl ? new URL(`/render.html?url=${encodeURIComponent(url)}&timeout=10&wait=0.5`, splashUrl).href : url;

  const response = await fetch(fetchURL);
  const html = await response.text();
  const $ = cheerio.load(html);
  const articleText = $("body").text();

  const documents = [];
  for (let start = 0; start < articleText.length; start += DOC_SIZE) {
    const chunk = articleText.substring(start, start + DOC_SIZE);
    documents.push({ url, body: chunk });
  }
}