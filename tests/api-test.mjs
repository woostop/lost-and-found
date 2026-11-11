// Supabase 분실물 API 통합 테스트 (Node 18+)
//
// 사용법 (Git Bash):
//   EMAIL=you@example.com PASSWORD='비밀번호' node tests/api-test.mjs
//
// - 계정이 없으면 회원가입부터 한다. 이메일 인증이 켜져 있으면 받은 메일의 링크를 누른 뒤 다시 실행.
// - 테스트로 만든 글과 사진은 마지막에 지운다.

const SUPABASE_URL = "https://uwtdwmsegndaotvanbjy.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_B971lN6mMWf1VNnJvmoybw_vDSqSPu8";

const { EMAIL, PASSWORD, NICKNAME = "테스터" } = process.env;
if (!EMAIL || !PASSWORD) {
  console.error("EMAIL, PASSWORD 환경변수를 넣어주세요. 예) EMAIL=a@b.com PASSWORD='...' node tests/api-test.mjs");
  process.exit(1);
}

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++;
  else failed++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? `  → ${detail}` : ""}`);
}

async function call(method, path, { token, body, headers = {}, raw } = {}) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: PUBLISHABLE_KEY,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined && !raw ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

// ── 1. 로그인 (없으면 회원가입) ─────────────────────────────
let login = await call("POST", "/auth/v1/token?grant_type=password", { body: { email: EMAIL, password: PASSWORD } });
if (login.status !== 200) {
  console.log("로그인 실패 → 회원가입 시도");
  const signup = await call("POST", "/auth/v1/signup", {
    body: { email: EMAIL, password: PASSWORD, data: { nickname: NICKNAME } },
  });
  check("회원가입 요청", signup.status === 200, `HTTP ${signup.status} ${signup.status !== 200 ? JSON.stringify(signup.data) : ""}`);
  if (!signup.data?.access_token) {
    console.log("\n📧 이메일 인증이 필요해요. 메일함의 확인 링크를 누른 뒤 같은 명령을 다시 실행하세요.");
    process.exit(0);
  }
  login = { status: 200, data: signup.data };
}
check("로그인", login.status === 200, `HTTP ${login.status}`);
if (login.status !== 200) process.exit(1);
const token = login.data.access_token;
const userId = login.data.user.id;

// ── 2. 내 프로필 (가입 트리거로 자동 생성) ───────────────────
const profile = await call("GET", `/rest/v1/profiles?id=eq.${userId}&select=*`, { token });
check("프로필 자동 생성", profile.status === 200 && profile.data.length === 1, JSON.stringify(profile.data?.[0] ?? profile.data));

// ── 3. 글 작성 ──────────────────────────────────────────────
const created = await call("POST", "/rest/v1/items?select=*", {
  token,
  headers: { Prefer: "return=representation" },
  body: {
    user_id: userId,
    type: "lost",
    title: "[테스트] 지갑 잃어버렸어요",
    description: "어제 저녁 학생회관 2층 화장실 근처에서 검은색 가죽 반지갑 잃어버림.. 안에 학생증이랑 카드 2장 있고 모서리 좀 까져있어요",
    category: "지갑",
    location: "학생회관",
    occurred_at: new Date().toISOString().slice(0, 10),
  },
});
check("글 작성", created.status === 201, `HTTP ${created.status} ${created.status !== 201 ? JSON.stringify(created.data) : ""}`);
const item = created.data?.[0];
if (!item) process.exit(1);

// ── 4. AI 정리 (+ ai_summary 저장) ──────────────────────────
const ai = await call("POST", "/functions/v1/ai-summarize", {
  token,
  body: { description: item.description, title: item.title, location: item.location, type: item.type, item_id: item.id },
});
check("AI 정리", ai.status === 200 && ai.data?.summary?.category, `HTTP ${ai.status} ${JSON.stringify(ai.data)}`);
check("AI 결과 저장 (saved=true)", ai.data?.saved === true);

// ── 5. 목록 + 필터 (비로그인도 읽기 가능) ─────────────────────
const list = await call("GET", "/rest/v1/items?select=id,title,type,category,status,ai_summary,profiles(nickname)&type=eq.lost&category=eq.지갑&order=created_at.desc");
check("비로그인 목록 조회 + 필터", list.status === 200 && list.data.some((r) => r.id === item.id), `HTTP ${list.status}, ${list.data?.length}건`);
const saved = list.data?.find((r) => r.id === item.id);
check("목록에 ai_summary 포함", !!saved?.ai_summary, JSON.stringify(saved?.ai_summary));

// ── 6. 사진 업로드 (본인 폴더) ──────────────────────────────
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const imagePath = `${userId}/${item.id}.png`;
const upload = await call("POST", `/storage/v1/object/item-images/${imagePath}`, {
  token, raw: png, headers: { "Content-Type": "image/png" },
});
check("본인 폴더에 사진 업로드", upload.status === 200, `HTTP ${upload.status} ${upload.status !== 200 ? JSON.stringify(upload.data) : ""}`);

const setImage = await call("PATCH", `/rest/v1/items?id=eq.${item.id}`, { token, body: { image_path: imagePath } });
check("글에 image_path 저장", setImage.status === 204, `HTTP ${setImage.status}`);

const publicImg = await fetch(`${SUPABASE_URL}/storage/v1/object/public/item-images/${imagePath}`);
check("공개 URL로 사진 보기", publicImg.status === 200, `HTTP ${publicImg.status}`);

const otherFolder = await call("POST", `/storage/v1/object/item-images/00000000-0000-0000-0000-000000000000/x.png`, {
  token, raw: png, headers: { "Content-Type": "image/png" },
});
check("남의 폴더 업로드 차단", otherFolder.status >= 400, `HTTP ${otherFolder.status}`);

const notImage = await call("POST", `/storage/v1/object/item-images/${userId}/x.txt`, {
  token, raw: "hello", headers: { "Content-Type": "text/plain" },
});
check("이미지가 아닌 파일 차단", notImage.status >= 400, `HTTP ${notImage.status}`);

// ── 7. 권한 차단 확인 ───────────────────────────────────────
const anonInsert = await call("POST", "/rest/v1/items", {
  body: { user_id: userId, type: "found", title: "anon" },
});
check("비로그인 글 작성 차단", anonInsert.status >= 400, `HTTP ${anonInsert.status}`);

const anonAi = await call("POST", "/functions/v1/ai-summarize", { token: PUBLISHABLE_KEY, body: { description: "x" } });
check("비로그인 AI 호출 차단", anonAi.status === 401, `HTTP ${anonAi.status}`);

// ── 8. 찾았어요(해결) 처리 ──────────────────────────────────
const resolve = await call("PATCH", `/rest/v1/items?id=eq.${item.id}&select=status`, {
  token, headers: { Prefer: "return=representation" }, body: { status: "resolved" },
});
check("해결 처리", resolve.status === 200 && resolve.data?.[0]?.status === "resolved", `HTTP ${resolve.status}`);

// ── 9. 정리: 사진 삭제 → 글 삭제 ─────────────────────────────
const delImg = await call("DELETE", `/storage/v1/object/item-images`, { token, body: { prefixes: [imagePath] } });
check("본인 사진 삭제", delImg.status === 200 && Array.isArray(delImg.data) && delImg.data.length === 1, `HTTP ${delImg.status}, ${delImg.data?.length ?? 0}개 삭제`);

const delItem = await call("DELETE", `/rest/v1/items?id=eq.${item.id}`, { token, headers: { Prefer: "return=representation" } });
check("본인 글 삭제", delItem.status === 200 && delItem.data?.length === 1, `HTTP ${delItem.status}`);

console.log(`\n결과: ${passed} 통과 / ${failed} 실패`);
process.exit(failed ? 1 : 0);
