import * as cheerio from "cheerio";
import pLimit from "p-limit";
import fetch from "node-fetch";
import { getProjectUrls, saveToSupabase } from "./supabase";

const DOC_SIZE = 1000;
  
//TODO: Improve the text scrapping logic
/**
 * Fetches documents from a URL and returns the body text in chunks.
 * @param {string} url - The URL to fetch documents from.
 * @returns {Promise<{url: string; body: string}[]>} - An array of objects containing URL and document body text chunks.
 */
async function fetchDocuments(url: string): Promise<{url: string; body: string}[]> {
  const splashUrl = process.env.SPLASH_URL;
  const fetchURL = splashUrl
    ? new URL(`/render.html?url=${encodeURIComponent(url)}&timeout=10&wait=0.5`, splashUrl).href
    : url;

  const response = await fetch(fetchURL);
  const html = await response.text();
  const $ = cheerio.load(html);
  const articleText: string = $("body").text();

  const documents: {url: string; body: string}[] = [];
  for (let start = 0; start < articleText.length; start += DOC_SIZE) {
    const chunk = articleText.substring(start, start + DOC_SIZE);
    documents.push({ url, body: chunk });
  }

  return documents;
}

/**
 * Fetches documents from multiple URLs and returns their body text.
 * Limits the number of concurrent requests to 10.
 * @param {string[]} urls - An array of URLs to fetch documents from.
 * @returns {Promise<{url: string; body: string}[]>} - An array of objects containing URL and document body text chunks.
 */
async function getDocuments(urls: string[]): Promise<{url: string; body: string}[]> {
  const limit = pLimit(10);
  const pageText = urls.map((url) => limit(() => fetchDocuments(url)));

  const allDocuments = await Promise.all(pageText);

  return allDocuments.flat();
}

/**
 * Fetches the embedding for a given input using the OpenAI API.
 * @param {string} input - The input text to be embedded.
 * @returns {Promise<number[]>} - An array containing the embedding.
 */
export async function getEmbedding(input: string): Promise<number[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  const apiURL = process.env.OPENAI_PROXY || "https://api.openai.com";

  const embeddingResponse = await fetch(`${apiURL}/v1/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      input,
      model: "text-embedding-ada-002"
    })
  });

  const embeddingData = await embeddingResponse.json();
  const [{ embedding }] = embeddingData.data;
  return embedding;
}

/**
 * Crawls URLs, converts documents to embeddings, and stores them in the Supabase table.
 * @param {string[]} docURLs - An array of URLs to crawl and convert to embeddings.
 * @param {string} id - The project ID to store the embeddings in.
 */
async function scrapeAndEmbed(docURLs: string[], id: string) {
  const documents = await getDocuments(docURLs);

  for (const { url, body } of documents) {
    const input = body.replace(/\n/g, " ");
    const embedding = await getEmbedding(input);
    await saveToSupabase({ url, input, embedding, id });
  }
}

/**
 * Entry point. Creates and stores embeddings for a given project ID.
 * @param {string} projectID - The project ID containing the URLs to crawl and convert to embeddings.
 */
export async function setEmbeddings(projectID: string) {
  const urls = await getProjectUrls(projectID);
  await scrapeAndEmbed(urls, projectID);
}
