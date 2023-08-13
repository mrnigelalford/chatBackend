import pLimit from "p-limit";
import fetch from "node-fetch";
import { getProjectUrls, saveToSupabase } from "./supabase.js";
import natural from 'natural';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import axios from "axios";

const DOC_SIZE = 8000;  // Roughly equivalent to 1600-2000 tokens in GPT-3

/**
 * Fetches documents from a URL and returns the body text in chunks.
 * @param {string} url - The URL to fetch documents from.
 * @returns {Promise<{url: string; body: string}[]>} - An array of objects containing URL and document body text chunks.
 */

async function fetchDocuments(url: string): Promise<{ url: string; body: string }[]> {
  const splashUrl = process.env.SPLASH_URL;
  const fetchURL = splashUrl
    ? new URL(`/render.html?url=${encodeURIComponent(url)}&timeout=10&wait=0.5`, splashUrl).href
    : url;

  const response = await fetch(fetchURL);
  const html = await response.text();

  const doc = new JSDOM(html, { url });
  const reader = new Readability(doc.window.document);
  const article = reader.parse();

  if (!article) {
    // Handle the case where no article content could be extracted.
    // Here we simply return an empty array.
    return [];
  }
  const { SentenceTokenizer } = natural;
  const tokenizer = new SentenceTokenizer();
  const sentences = tokenizer.tokenize(article.textContent);

  const documents: { url: string; body: string }[] = [];
  let chunk = '';
  for (const sentence of sentences) {
    if ((chunk + sentence).length > DOC_SIZE) {
      documents.push({ url, body: chunk });
      chunk = sentence;
    } else {
      chunk += ' ' + sentence;
    }
  }
  if (chunk) documents.push({ url, body: chunk });

  return documents;
}

/**
 * Fetches documents from multiple URLs and returns their body text.
 * Limits the number of concurrent requests to 10.
 * @param {string[]} urls - An array of URLs to fetch documents from.
 * @returns {Promise<{url: string; body: string}[]>} - An array of objects containing URL and document body text chunks.
 */
async function getDocuments(urls: string[]): Promise<{ url: string; body: string }[]> {
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

  const embeddingResponse = await axios.post(`https://api.openai.com/v1/embeddings`, {
    input,
    model: process.env.EMBEDDING_MODEL
  }, {
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  return embeddingResponse.data.data[0].embedding;
}

/**
 * Crawls URLs, converts documents to embeddings, and stores them in the Supabase table.
 * @param {string[]} docURLs - An array of URLs to crawl and convert to embeddings.
 * @param {string} id - The project ID to store the embeddings in.
 */
async function scrapeAndEmbed(docURLs: string[], projectID: string) {
  const documents = await getDocuments(docURLs);

  for (const { url, body } of documents) {
    const input = body.replace(/\n/g, " ");
    const embedding = await getEmbedding(input);
    await saveToSupabase({ url, input, embedding, id: projectID }, projectID);
  }
}

/**
 * Entry point. Creates and stores embeddings for a given project ID.
 * @param {string} projectID - The project ID containing the URLs to crawl and convert to embeddings.
 */
export async function setEmbeddings(projectID: string) {
  const urls = await getProjectUrls(projectID);

  if (urls && urls?.length) {
    await scrapeAndEmbed(urls, projectID);
  }
}
