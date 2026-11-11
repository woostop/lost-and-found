// ai-summarize: 대충 쓴 분실물 설명을 물품명 / 색상 / 장소 / 특징으로 정리하고 카테고리를 추천한다.
//
// POST /functions/v1/ai-summarize
// Headers: Authorization: Bearer <로그인한 사용자의 access_token>
// Body: { "description": string, "title"?: string, "location"?: string, "type"?: "lost" | "found", "item_id"?: uuid }
//   - item_id 를 주면 결과를 items.ai_summary 에 저장한다 (RLS 때문에 작성자 본인 글만 저장됨).
// Response 200: { "summary": { item_name, color, location, features[], category }, "saved": boolean }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Anthropic from "npm:@anthropic-ai/sdk";
import { createClient } from "npm:@supabase/supabase-js@2";

const CATEGORIES = ["전자기기", "지갑", "가방", "의류", "신분증/카드", "열쇠", "액세서리", "기타"] as const;

type Summary = {
  item_name: string;
  color: string;
  location: string;
  features: string[];
  category: (typeof CATEGORIES)[number];
};

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    item_name: { type: "string", description: "물품 이름 (예: 에어팟 프로 2, 반지갑)" },
    color: { type: "string", description: "색상. 알 수 없으면 빈 문자열" },
    location: { type: "string", description: "잃어버리거나 주운 장소. 알 수 없으면 빈 문자열" },
    features: {
      type: "array",
      items: { type: "string" },
      description: "브랜드, 스티커, 흠집, 안에 든 물건 등 찾는 데 도움 되는 특징. 짧은 구절로",
    },
    category: { type: "string", enum: [...CATEGORIES] },
  },
  required: ["item_name", "color", "location", "features", "category"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `너는 분실물 게시판의 글 정리 도우미야.
사용자가 대충 쓴 분실물 설명을 읽고 물품명, 색상, 장소, 특징을 뽑아내고 카테고리를 하나 고른다.
- 글에 없는 정보는 지어내지 말고 빈 문자열(특징은 빈 배열)로 둔다.
- 모든 값은 한국어로, 짧고 검색하기 좋게 쓴다.
- 카테고리는 주어진 목록에서만 고르고, 애매하면 "기타"를 고른다.`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const anthropic = new Anthropic(); // ANTHROPIC_API_KEY (Supabase secret)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 로그인한 사용자만 허용 (anon 키만으로는 호출 불가 → AI 비용 남용 방지)
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  if (!user) return json({ error: "login_required" }, 401);

  let body: { description?: unknown; title?: unknown; location?: unknown; type?: unknown; item_id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return json({ error: "description_required" }, 400);
  if (description.length > 2000) return json({ error: "description_too_long", max: 2000 }, 400);

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const kind = body.type === "found" ? "주웠어요" : body.type === "lost" ? "잃어버렸어요" : "";

  const userText = [
    kind && `구분: ${kind}`,
    title && `제목: ${title}`,
    location && `사용자가 적은 장소: ${location}`,
    `설명: ${description}`,
  ].filter(Boolean).join("\n");

  let summary: Summary;
  try {
    const response = await anthropic.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: SUMMARY_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userText }],
    });

    if (response.stop_reason === "refusal") return json({ error: "ai_refused" }, 422);
    if (response.stop_reason === "max_tokens") return json({ error: "ai_incomplete" }, 502);

    const text = response.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return json({ error: "ai_empty_response" }, 502);
    summary = JSON.parse(text.text) as Summary;
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return json({ error: "ai_rate_limited" }, 429);
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("ANTHROPIC_API_KEY is missing or invalid");
      return json({ error: "ai_not_configured" }, 500);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message);
      return json({ error: "ai_upstream_error" }, 502);
    }
    console.error(error);
    return json({ error: "ai_failed" }, 500);
  }

  // item_id 가 있으면 저장 (RLS: 작성자 본인 글만 업데이트됨)
  let saved = false;
  if (typeof body.item_id === "string" && body.item_id) {
    const { data, error } = await supabase
      .from("items")
      .update({ ai_summary: summary })
      .eq("id", body.item_id)
      .select("id");
    if (error) console.error("save failed:", error.message);
    saved = !error && (data?.length ?? 0) > 0;
  }

  return json({ summary, saved });
});
