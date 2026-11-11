import { createClient } from "@supabase/supabase-js";

// 공개용 값이라 기본값으로 넣어둠. Vercel 환경변수로 덮어쓸 수 있음.
const url = import.meta.env.VITE_SUPABASE_URL ?? "https://uwtdwmsegndaotvanbjy.supabase.co";
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_B971lN6mMWf1VNnJvmoybw_vDSqSPu8";

export const supabase = createClient(url, key);

export const BUCKET = "item-images";

export function imageUrl(path) {
  if (!path) return null;
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
