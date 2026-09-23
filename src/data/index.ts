import type { Backend } from './backend';
import { demoBackend } from './demoBackend';
import { makeSupabaseBackend } from './supabaseBackend';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Sans configuration Supabase, l'application tourne en mode démo. */
export const backend: Backend = url && key ? makeSupabaseBackend(url, key) : demoBackend;
