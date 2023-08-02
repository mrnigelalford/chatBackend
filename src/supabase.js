var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
dotenv.config();
const client = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY
};
if (!client.url || !client.key) {
    throw new Error("Missing Supabase credentials");
}
const supabaseClient = createClient(client.url, client.key);
export function setDocument(url) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info('upserting ', url.length, ' records');
            return supabaseClient.from('external_urls').upsert(url, { ignoreDuplicates: true }).select();
        }
        catch (error) {
            return error;
        }
    });
}
