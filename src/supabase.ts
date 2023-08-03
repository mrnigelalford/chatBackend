import { PostgrestError, PostgrestSingleResponse, createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';

dotenv.config();

interface QuestionEmbedding {
  question: string;
  input?: string;
  embedding: number[];
  location: string;
}

interface Embedding {
  url: string;
  id: string;
  content: string;
  gpt_response?: string;
}

interface Client {
  url?: string;
  key?: string;
}

const client: Client = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.SUPABASE_ANON_KEY
};

if (!client.url || !client.key) {
  throw new Error("Missing Supabase credentials");
}

export const supabaseClient = createClient(client.url!, client.key!);

export async function setDocument(url: { url: string }[]): Promise<PostgrestSingleResponse<never[]> | PostgrestError> {
  try {
    console.info('upserting ', url.length, ' records');
    return supabaseClient.from('external_urls').upsert(url, { ignoreDuplicates: true }).select();
  } catch (error) {
    return error as PostgrestError;
  }
}

interface dbInput {
  url: string, input: string, embedding: number[]; id: string;
}

// Save Embedding to Supabase
export async function saveToSupabase(crawl: dbInput): Promise<void> {
  try {
    await supabaseClient.from(`${crawl.id}_documents`).insert({
      content: crawl.input,
      embedding: crawl.embedding,
      url: crawl.url
    });
  } catch (error) {
    console.error("Error in Supabase insert: ", error);
  }
}

export async function getProjectUrls(projectID: string): Promise<string[]> {
  try {
    const { data } = await supabaseClient
      .from(`${projectID}_external_urls`)
      .select('url')
      .is('last_embed_date', null);

    // Extract the 'url' property from each item in the 'data' array
    const urls: string[] = data.map((item: { url: string }) => item.url);

    return urls;
  } catch (error) {
    console.error("Error in Supabase select: ", error);
    return [];
  }
}

export async function setQuestionEmbedding({ question, embedding, location }: QuestionEmbedding): Promise<void> {
  try {
    await supabaseClient.from(location).insert({
      embedding,
      question,
    });
  } catch (error) {
    console.error("Error in setStoredEmbedding: ", error);
    throw error;
  }
}


export async function getQuestionEmbedding(question: string, location: string): Promise<{embedding: number[], question: string, id: number} | null> {
  try {
    const { data: embeddings, error } = await supabaseClient.from(location).select('*').ilike('question', `%${question}%`);
    if (error) {
      throw new Error("Error fetching question embedding.");
    }
    return embeddings?.[0] || null;
  } catch (error) {
    console.error("Error in getQuestionEmbedding: ", error);
    throw error;
  }
}

export async function getSimilarEmbeddings(embedding: number[]): Promise<Embedding | null> {
  try {
    const { data: documents, error } = await supabaseClient.rpc(
      "match_documents",
      {
        query_embedding: embedding,
        similarity_threshold: 0.1, // Choose an appropriate threshold for your data
        match_count: 3, // Choose the number of matches
      }
    );

    if (error) {
      throw new Error("Error fetching similar embeddings.");
    }

    return documents?.[0] || null;
  } catch (error) {
    console.error('Error in getSimilarEmbeddings: ', error);
    throw error;
  }
}

// Add gptResponse to document
export async function updateSupabaseDoc(text: string, location: string, id: number): Promise<void> {
  try {
    await supabaseClient.from(location).update({ 'gpt_response': text }).eq('id', id);
  } catch (error) {
    console.error("Error in updateSupabaseDoc: ", error);
    throw error;
  }
}