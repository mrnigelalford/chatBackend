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
