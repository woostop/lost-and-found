import { useEffect, useRef, useState } from "react";
import { loadKakao } from "../lib/kakao.js";

// 상세 페이지용: 핀 하나 찍힌 작은 지도
export default function StaticMap({ lat, lng, label }) {
  const el = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadKakao()
      .then((kakao) => {
        if (cancelled || !el.current) return;
        const pos = new kakao.maps.LatLng(lat, lng);
        const map = new kakao.maps.Map(el.current, { center: pos, level: 3 });
        new kakao.maps.Marker({ map, position: pos });
        map.setZoomable(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  if (failed) return null;

  const link = `https://map.kakao.com/link/map/${encodeURIComponent(label || "분실물 위치")},${lat},${lng}`;
  return (
    <div className="static-map">
      <div ref={el} className="static-map-canvas" />
      <a href={link} target="_blank" rel="noreferrer" className="static-map-link">
        카카오맵에서 크게 보기 ↗
      </a>
    </div>
  );
}
