import { PostgrestError, PostgrestSingleResponse, createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
import { ChatCompletion } from "openai/resources";

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
  key: process.env.SUPABASE_SERVICE_ROLE_KEY
};

if (!client.url || !client.key) {
  throw new Error("Missing Supabase credentials");
}

export const supabaseClient = createClient(client.url, client.key, {
  auth: {
    persistSession: false
  }
});

export async function setDocument(url: { url: string }[], projectID: string): Promise<PostgrestSingleResponse<never[]> | PostgrestError> {
  try {
    const location = `${projectID.toLowerCase()}_external_urls`;
    console.info('upserting ', url.length, ' records to: ', location);
    return supabaseClient.from(location).upsert(url, { ignoreDuplicates: true }).select();
  } catch (error) {
    return error as PostgrestError;
  }
}

interface dbInput {
  url: string, input: string, embedding: number[]; id: string;
}

// Save Embedding to Supabase
export async function saveToSupabase(crawl: dbInput, projectID: string): Promise<void> {
  try {
    console.log('setting Doc from: ', crawl.url);
    await supabaseClient.from(`${crawl.id.toLowerCase()}_documents`).insert({
      content: crawl.input,
      embedding: crawl.embedding,
      url: crawl.url
    });
    await supabaseClient.rpc('update_external_urls_last_embed_date', {
      external_table_name: `${projectID}_external_urls`,
      documents_table_name: `${projectID}_documents`
    })
  } catch (error) {
    console.error("Error in Supabase insert: ", error);
  }
}

export async function getProjectUrls(projectID: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseClient
      .from(`${projectID.toLowerCase()}_external_urls`)
      .select('url')
      .is('last_embed_date', null);

    if (error) console.log('error: ', error);

    // Extract the 'url' property from each item in the 'data' array
    const urls: string[] = data?.map((item: { url: string }) => item.url);

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


export async function getQuestionEmbedding(question: string, location: string): Promise<{ embedding: number[], question: string, id: number } | null> {
  try {
    const { data: embeddings, error } = await supabaseClient.from(location.toLowerCase()).select('*').ilike('question', `%${question}%`);
    if (error) {
      throw new Error(JSON.stringify(error));
    }
    return embeddings?.[0] || null;
  } catch (error) {
    console.error("Error in getQuestionEmbedding: ", error);
    throw error;
  }
}

export async function getSimilarEmbeddings(embedding: number[], projectID: string): Promise<Embedding | null> {
  try {
    console.log(`asking: ${projectID.toLowerCase()}_documents`);
    const { data: documents, error } = await supabaseClient.rpc(
      "match_documents",
      {
        query_embedding: embedding,
        similarity_threshold: 0.1, // Choose an appropriate threshold for your data
        match_count: 3, // Choose the number of matches,
        documents_table_name: `${projectID.toLowerCase()}_documents`
      }
    );

    if (error) {
      throw new Error(JSON.stringify(error));
    }

    return documents?.[0] || null;
  } catch (error) {
    console.error('Error in getSimilarEmbeddings: ', error);
    throw error;
  }
}

// Add gptResponse to document
export async function updateSupabaseDoc(text: ChatCompletion, location: string, id: number): Promise<void> {
  try {
    const update = await supabaseClient.from(location).update({ 'gpt_response': text }).eq('id', id);
    console.log(`write resposne: (${update.status}) ${update.statusText}`)
  } catch (error) {
    console.error("Error in updateSupabaseDoc: ", error);
    throw error;
  }
}