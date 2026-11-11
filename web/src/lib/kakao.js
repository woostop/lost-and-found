// 카카오맵 SDK를 필요할 때 한 번만 불러온다.
// JavaScript 키는 브라우저에 노출되는 공개 키라 기본값으로 넣어둠 (supabase.js와 같은 방식).
// 카카오 디벨로퍼스에 등록한 도메인(배포 주소, 미리보기 주소, localhost:5173)에서만 동작한다.
export const KAKAO_KEY = import.meta.env.VITE_KAKAO_MAP_KEY || "f6d3e1e388e51f5a3f36ba46c4e78c0d";

let loading = null;

export function loadKakao() {
  if (window.kakao?.maps?.services) return Promise.resolve(window.kakao);
  if (!KAKAO_KEY) return Promise.reject(new Error("카카오맵 키(VITE_KAKAO_MAP_KEY)가 설정되지 않았어요."));
  if (loading) return loading;

  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_KEY}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao));
    script.onerror = () => {
      loading = null;
      reject(new Error("카카오맵을 불러오지 못했어요. 도메인 등록과 키를 확인해 주세요."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

// 동국대 본관 근처를 기본 위치로
export const DEFAULT_CENTER = { lat: 37.5582, lng: 127.0002 };
