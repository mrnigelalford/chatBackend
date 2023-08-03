import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { getProjectUrls, saveToSupabase } from "./supabase";

const DOC_SIZE = 1000;

/**
 * 
 * @param url string
 * @returns {url: string, body: string}
 * @description crawls a url and returns all text on the page.
 */
async function fetchDocuments(url: string): Promise<{url: string; body: string}[]> {
  //TODO: Improve the text scrapping logic
  const splashUrl = process.env.SPLASH_URL;
  const fetchURL = splashUrl ? new URL(`/render.html?url=${encodeURIComponent(url)}&timeout=10&wait=0.5`, splashUrl).href : url;
  
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
 * 
 * @param urls string
 * @returns Object: url: string, body: string
 * @description limiting function to batch page crawling into batch of 10.
 * Will return ALL urls and their page text.
 */
async function getDocuments(urls: string[]): Promise<{url: string; body: string}[]> {
  // Set a limit of 10 concurrent promises
  const limit = pLimit(10);
  const pageText = urls.map((url) => limit(() => fetchDocuments(url)));

  // Now, no more than 10 promises will be run at once.
  const allDocuments = await Promise.all(pageText);

  return allDocuments.flat();
}


/**
 * 
 * @param input string
 * @description create openAI embedding for page docs using model `text-embedding-ada-002`
 * @returns complete embedding
 */
async function getEmbedding(input: string): Promise<number[]> {

  const apiKey = process.env.OPENAI_API_KEY;
  const apiURL = process.env.OPENAI_PROXY || "https://api.openai.com";

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

/**
 * 
 * @param docURLs 
 * @description for each url, pull documents, convert to emebedding, store in supabase
 */
async function scrapeAndEmbed(docURLs: string[], id: string) {
  const documents = await getDocuments(docURLs);

  for (const { url, body } of documents) {
    const input = body.replace(/\n/g, " ");
    const embedding = await getEmbedding(input);
    await saveToSupabase({url, input, embedding, id});
  }
}

/**
 * 
 * @param projectID 
 * @description Entry point. Create and store embeddings for a given project id
 * example. projectID = 'balancer'
 * All urls are stored in a supabase table '[project_id]_external_urls
 */
export async function setEmbeddings(projectID: string) {
  const urls = await getProjectUrls(projectID);
  await scrapeAndEmbed(urls, projectID);
}