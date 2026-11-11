# 분실물 게시판 API 명세

Supabase(프로젝트 `lost-and-found`, 서울 리전) 위에 만든 백엔드입니다. 별도 서버 없이 **supabase-js** 또는 REST로 바로 호출합니다.

| 항목 | 값 |
|---|---|
| Base URL | `https://uwtdwmsegndaotvanbjy.supabase.co` |
| Publishable key | `sb_publishable_B971lN6mMWf1VNnJvmoybw_vDSqSPu8` (프론트엔드에 넣어도 되는 공개 키) |
| 사진 버킷 | `item-images` (공개 읽기, 5MB, jpeg/png/webp/gif/heic) |

```js
import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(
  "https://uwtdwmsegndaotvanbjy.supabase.co",
  "sb_publishable_B971lN6mMWf1VNnJvmoybw_vDSqSPu8",
);
```

REST로 직접 부를 때는 모든 요청에 `apikey: <publishable key>` 헤더를 붙이고, 로그인이 필요한 요청에는 `Authorization: Bearer <access_token>`을 추가합니다.

---

## 권한 요약

| 대상 | 읽기 | 작성 | 수정 | 삭제 |
|---|---|---|---|---|
| `profiles` | 누구나 | 가입 시 자동 생성 | 본인 | ✗ |
| `items` | 누구나 | 로그인 사용자 (본인 `user_id`로만) | 작성자 | 작성자 |
| `item-images` 사진 | 누구나 (공개 URL) | 로그인 사용자, `{내 user id}/` 폴더에만 | 본인 폴더 | 본인 폴더 |
| `ai-summarize` 함수 | — | 로그인 사용자만 호출 | — | — |

권한에 막힌 수정·삭제는 **에러 없이 0건 처리**됩니다. 결과 행 수로 성공 여부를 확인하세요.

---

## 데이터 모델

### `profiles`
| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid, PK | `auth.users.id`와 같음 |
| `nickname` | text (1–30자) | 가입 시 `options.data.nickname`, 없으면 이메일 @ 앞부분 |
| `created_at` | timestamptz | |

### `items`
| 컬럼 | 타입 | 기본값 | 설명 |
|---|---|---|---|
| `id` | uuid, PK | 자동 | |
| `user_id` | uuid → profiles | (필수) | 작성자. 반드시 내 user id |
| `type` | text | (필수) | `lost` 잃어버렸어요 / `found` 주웠어요 |
| `title` | text (1–100자) | (필수) | |
| `description` | text | `''` | |
| `category` | text | `기타` | `전자기기` `지갑` `가방` `의류` `신분증/카드` `열쇠` `액세서리` `기타` 중 하나 |
| `location` | text | null | |
| `occurred_at` | date | null | 잃어버린/주운 날짜 `YYYY-MM-DD` |
| `image_path` | text | null | Storage 경로 (`{user_id}/{파일명}`) |
| `ai_summary` | jsonb | null | AI 정리 결과 (아래 형식) |
| `status` | text | `open` | `open` / `resolved`(찾았어요) |
| `created_at` | timestamptz | 자동 | |

`ai_summary` 형식:
```json
{ "item_name": "반지갑", "color": "검은색", "location": "학생회관 2층 화장실 근처",
  "features": ["가죽", "학생증과 카드 2장", "모서리 까짐"], "category": "지갑" }
```

---

## 1. 인증

| 기능 | supabase-js | REST |
|---|---|---|
| 회원가입 | `supabase.auth.signUp({ email, password, options: { data: { nickname } } })` | `POST /auth/v1/signup` `{ email, password, data: { nickname } }` |
| 로그인 | `supabase.auth.signInWithPassword({ email, password })` | `POST /auth/v1/token?grant_type=password` `{ email, password }` |
| 로그아웃 | `supabase.auth.signOut()` | `POST /auth/v1/logout` |
| 현재 사용자 | `supabase.auth.getUser()` | `GET /auth/v1/user` |

- 이메일 인증이 켜져 있어 가입 직후에는 `session`이 `null`입니다. 메일 링크를 누른 뒤 로그인하세요.
- 로그인 응답의 `access_token`이 이후 요청의 Bearer 토큰입니다. supabase-js는 자동으로 붙여줍니다.

## 2. 프로필

```js
// 조회
const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
// 닉네임 변경 (본인만)
await supabase.from("profiles").update({ nickname: "새닉네임" }).eq("id", userId);
```

## 3. 분실물 글

### 목록 + 필터
```js
let q = supabase
  .from("items")
  .select("id, type, title, category, location, occurred_at, image_path, status, ai_summary, created_at, profiles(nickname)")
  .order("created_at", { ascending: false })
  .range(0, 19);                       // 페이지네이션 (20개씩)

if (type) q = q.eq("type", type);           // 'lost' | 'found'
if (category) q = q.eq("category", category);
if (onlyOpen) q = q.eq("status", "open");
if (keyword) q = q.ilike("title", `%${keyword}%`);

const { data, error } = await q;
```
REST: `GET /rest/v1/items?select=*,profiles(nickname)&type=eq.lost&category=eq.지갑&status=eq.open&order=created_at.desc&limit=20&offset=0`

### 상세
```js
const { data } = await supabase.from("items").select("*, profiles(nickname)").eq("id", id).single();
```

### 작성 (로그인 필요)
```js
const { data: { user } } = await supabase.auth.getUser();
const { data, error } = await supabase.from("items").insert({
  user_id: user.id, type: "lost", title, description, category, location, occurred_at,
}).select().single();
```

### 수정 / 찾았어요 처리 / 삭제 (작성자만)
```js
await supabase.from("items").update({ title, description }).eq("id", id);
await supabase.from("items").update({ status: "resolved" }).eq("id", id);   // 찾았어요
await supabase.from("items").delete().eq("id", id);
```
글을 지울 때 사진도 같이 지워주세요 (아래 4번).

## 4. 사진 (Storage)

경로 규칙: **`{내 user id}/{파일명}`**. 다른 폴더에는 올릴 수 없습니다.

```js
// 업로드
const path = `${user.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
const { error } = await supabase.storage.from("item-images").upload(path, file);
// 글에 연결
await supabase.from("items").update({ image_path: path }).eq("id", itemId);

// 화면에 표시 (로그인 불필요)
const url = supabase.storage.from("item-images").getPublicUrl(item.image_path).data.publicUrl;

// 삭제
await supabase.storage.from("item-images").remove([item.image_path]);
```
공개 URL 형식: `https://uwtdwmsegndaotvanbjy.supabase.co/storage/v1/object/public/item-images/{image_path}`

## 5. AI 정리 (Edge Function)

`POST /functions/v1/ai-summarize` — 로그인 사용자만 호출 가능.

| 요청 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `description` | string (≤2000자) | ✅ | 사용자가 대충 쓴 설명 |
| `title` | string | | |
| `location` | string | | |
| `type` | `lost` / `found` | | |
| `item_id` | uuid | | 주면 결과를 그 글의 `ai_summary`에 저장 (본인 글만) |

```js
const { data, error } = await supabase.functions.invoke("ai-summarize", {
  body: { description, title, location, type, item_id },
});
// data = { summary: { item_name, color, location, features, category }, saved: true|false }
```

**권장 흐름**: 글쓰기 화면에서 설명 입력 → "AI로 정리" 버튼 → `item_id` 없이 호출해 결과를 미리 보여주고 `summary.category`로 카테고리 선택값을 채움 → 저장할 때 `ai_summary: summary`를 같이 insert.
(이미 저장된 글을 다시 정리할 때만 `item_id`를 넘기면 됩니다.)

응답 시간은 보통 수 초입니다. 버튼에 로딩 표시를 넣어주세요.

---

## 에러

### 테이블 (PostgREST)
| 상황 | 결과 |
|---|---|
| 로그인 없이 작성 / 남의 `user_id`로 작성 | `401` 또는 `403`, code `42501` |
| 남의 글 수정·삭제 | 에러 없이 **0건** (`data`가 빈 배열) |
| 허용되지 않은 `type` / `category` / `status`, 제목 길이 초과 | `400`, code `23514` (check 제약) |

### Storage
| 상황 | 결과 |
|---|---|
| 남의 폴더 / 루트에 업로드, 비로그인 업로드 | 4xx (RLS 위반) |
| 5MB 초과 | 4xx (용량 초과) |
| 이미지가 아닌 파일 | 4xx (허용되지 않은 형식) |

Storage는 상태 코드보다 `error.message`로 구분하는 게 안전합니다.

### `ai-summarize`
| HTTP | `error` | 의미 |
|---|---|---|
| 400 | `invalid_json` / `description_required` / `description_too_long` | 요청 형식 오류 |
| 401 | `login_required` | 로그인 필요 |
| 422 | `ai_refused` | AI가 응답을 거부 |
| 429 | `ai_rate_limited` | 잠시 후 재시도 |
| 500 | `ai_not_configured` / `ai_failed` | 서버 설정 문제 |
| 502 | `ai_upstream_error` / `ai_incomplete` / `ai_empty_response` | AI 호출 실패, 재시도 가능 |

---

## 테스트

전체 흐름(가입 → 글쓰기 → AI 정리 → 사진 → 권한 차단 → 삭제) 통합 테스트:
```bash
EMAIL=you@example.com PASSWORD='...' node tests/api-test.mjs
```
