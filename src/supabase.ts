import { PostgrestError, PostgrestSingleResponse, createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';

dotenv.config();

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

const supabaseClient = createClient(client.url!, client.key!);

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