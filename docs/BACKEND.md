# 백엔드 작업 정리 (팀 공유용)

> 분실물 게시판 "찾아줘" 백엔드. Supabase(DB·인증·파일 저장) + Edge Function(AI 요약)으로 구성.
> API 상세 스펙은 [API.md](API.md) 참고.

## 한눈에 보기

| 항목 | 값 |
|---|---|
| Supabase 프로젝트 | `lost-and-found` (리전: 서울) |
| API 주소 | `https://uwtdwmsegndaotvanbjy.supabase.co` |
| 공개 키 (프론트용) | `sb_publishable_B971lN6mMWf1VNnJvmoybw_vDSqSPu8` (공개해도 되는 키) |
| 사진 버킷 | `item-images` (공개 읽기, 5MB 제한) |
| AI 함수 | `POST /functions/v1/ai-summarize` (로그인 필요) |
| 비용 | 월 $0 (Supabase 무료 플랜) + AI 호출 시 Claude API 사용료 |

## 진행 단계 (처음부터 순서대로)

### 1. Supabase 프로젝트 생성 ✅
- 서울 리전에 `lost-and-found` 프로젝트를 만들었어요.

### 2. 테이블 만들기 ✅
**profiles**: 회원 정보
- `id` (auth.users와 연결), `nickname` (1~30자), `created_at`
- 회원가입하면 트리거가 자동으로 프로필을 만들어요. 닉네임은 가입할 때 입력한 값을 쓰고, 없으면 이메일 앞부분을 써요.

**items**: 분실물 글
- `type`: `lost`(잃어버렸어요) / `found`(주웠어요)
- `title` (1~100자), `description`, `location`, `occurred_at` (날짜)
- `category`: 전자기기 / 지갑 / 가방 / 의류 / 신분증·카드 / 열쇠 / 액세서리 / 기타
- `image_path`: 사진 경로, `ai_summary`: AI 정리 결과 (JSON)
- `status`: `open` / `resolved`("찾았어요" 처리)
- 목록 필터용 인덱스를 추가했어요 (status, type, category, 최신순).

### 3. 권한(RLS) 설정 ✅
| | 비로그인 | 로그인 | 글쓴이 본인 |
|---|---|---|---|
| 글/프로필 보기 | O | O | O |
| 글쓰기 | X | O | O |
| 수정·삭제·해결 처리 | X | X | O |

- DB가 직접 막기 때문에 프론트에서 실수해도 남의 글은 못 고쳐요.

### 4. 사진 저장소(Storage) ✅
- 버킷 `item-images`를 만들었어요. 누구나 볼 수 있고, 이미지 파일만(jpeg/png/webp/gif/heic) 최대 5MB까지 올릴 수 있어요.
- 업로드 경로 규칙은 `{내 user id}/파일명`이에요. 내 폴더에만 올리고 지울 수 있어요.

### 5. AI 요약 Edge Function ✅
- 함수 이름은 `ai-summarize`예요. 대충 쓴 설명을 Claude(`claude-opus-5-5`)가 정리해 줘요.
- 입력: `description` (필수, 2000자 이하), 그리고 선택으로 `title`, `location`, `type`, `item_id`
- 출력: `{ item_name, color, location, features[], category }`. 카테고리도 추천해 줘요.
- `item_id`를 같이 보내면 해당 글에 결과를 저장해요. 본인 글에만 저장돼요.
- 비밀값 `ANTHROPIC_API_KEY`는 Supabase 대시보드 → Edge Functions → Secrets에 등록했어요.
- 코드 위치: `supabase/functions/ai-summarize/index.ts`

### 6. 통합 테스트 + API 문서 ✅
- 실제 서버를 대상으로 18개 항목을 검사해요. 전부 통과했어요.
  - 가입·로그인, 글쓰기, AI, 사진 업로드, 권한 차단, 해결 처리, 삭제
- 실행 방법:
  ```bash
  EMAIL=테스트계정 PASSWORD=비번 node tests/api-test.mjs
  ```
- API 문서: `docs/API.md`

## 남은 일

- [ ] **Vercel 배포**: GitHub `woostop/lost-and-found` 저장소를 Import하고, Root Directory를 `web`으로 설정해요.
- [ ] **Supabase 인증 주소 설정**: 대시보드 → Authentication → URL Configuration
  - Site URL에 Vercel 주소를 넣어요.
  - Redirect URLs에 `https://<vercel주소>/**`를 추가해요.
  - 이걸 안 하면 가입 확인 메일 링크가 localhost로 가요.
- [ ] 배포된 사이트에서 실제로 가입 → 글쓰기 → AI 요약 → 사진 → 수정·삭제까지 확인해요.
- [ ] (선택) 적용한 SQL을 `supabase/migrations/`에 파일로 저장해요. 지금은 원격 DB에만 있어요.

## 팀원별로 알아두면 좋은 것

**프론트엔드**
- 키 두 개(URL, publishable key)만 있으면 돼요. `web/.env.example`에 있어요.
- 사진은 반드시 `{user.id}/...` 경로로 올려야 해요. 다른 경로는 서버가 거부해요.
- AI 함수는 로그인 토큰이 필요해요. `supabase.functions.invoke("ai-summarize", { body })`로 부르면 토큰이 자동으로 붙어요.

**발표·기획**
- 핵심 포인트 세 가지:
  - 권한을 DB 수준에서 막아요 (RLS).
  - AI가 설명을 물건 이름, 색상, 장소, 특징으로 정리하고 카테고리를 추천해요.
  - 따로 서버를 만들지 않고 Supabase만으로 백엔드를 구성했어요.

**주의**
- `ANTHROPIC_API_KEY`, DB 비밀번호, service_role 키는 절대 코드나 채팅에 올리지 마세요.
- 공개 키(`sb_publishable_...`)는 공개돼도 괜찮아요. 권한은 RLS가 지켜요.

## 다음 기능 약속: 사례금 (reward)

백엔드와 프론트가 각자 브랜치에서 작업하기 전에 아래 내용을 먼저 정했어요.
이 약속대로만 만들면 합칠 때 안 깨져요.

| 항목 | 약속 |
|---|---|
| 컬럼 이름 | `items.reward` |
| 타입 | 정수(원 단위), 비워도 됨(`null` = 사례금 없음) |
| 범위 | 0 이상, 10,000,000 이하 (넘으면 DB가 거부: 에러 코드 `23514`) |
| 읽기/쓰기 | 기존 items 권한 그대로 (본인 글만 수정) |
| 브랜치 | 백엔드 `backend/reward`, 프론트 `frontend/reward` |
| 합치는 순서 | **백엔드 먼저** → DB에 컬럼이 생긴 뒤 프론트 |
