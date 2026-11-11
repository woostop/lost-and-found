export const CATEGORIES = ["전자기기", "지갑", "가방", "의류", "신분증/카드", "열쇠", "액세서리", "기타"];

export const TYPE_LABEL = { lost: "잃어버렸어요", found: "주웠어요" };

export const PAGE_SIZE = 20;

export function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function timeAgo(value) {
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
  return formatDate(value);
}

// Supabase 에러를 사용자에게 보여줄 문장으로
export function errorText(error) {
  const msg = error?.message ?? String(error);
  if (/Invalid login credentials/i.test(msg)) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (/Email not confirmed/i.test(msg)) return "이메일 인증이 아직 안 됐어요. 메일함의 확인 링크를 눌러주세요.";
  if (/User already registered/i.test(msg)) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (/Password should be at least/i.test(msg)) return "비밀번호는 6자 이상이어야 해요.";
  if (/rate limit/i.test(msg)) return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  if (/exceeded the maximum allowed size|Payload too large/i.test(msg)) return "사진 용량이 너무 커요 (최대 5MB).";
  if (/mime type/i.test(msg)) return "이미지 파일만 올릴 수 있어요.";
  return msg;
}
