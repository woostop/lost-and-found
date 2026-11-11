import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_CENTER, loadKakao } from "../lib/kakao.js";

/**
 * 카카오T 택시 잡을 때처럼 위치를 고르는 컴포넌트
 * 1) 대략적인 장소를 검색해서 그 근처로 이동하고
 * 2) 지도를 끌거나 눌러서 가운데 핀을 정확한 위치에 맞추면
 * 3) 핀 아래 주소가 자동으로 바뀌고, "이 위치로 할게요"를 눌러 확정한다.
 *
 * value: { lat, lng, address } | null
 * onConfirm({ lat, lng, address, placeName })
 */
export default function LocationPicker({ value, onConfirm, onClose }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const kakaoRef = useRef(null);
  const geocoderRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState("");
  const [moving, setMoving] = useState(false);
  const [center, setCenter] = useState(value?.lat ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER);
  const [address, setAddress] = useState(value?.address ?? "");
  const [placeName, setPlaceName] = useState("");

  // 지도 만들기
  useEffect(() => {
    let cancelled = false;
    loadKakao()
      .then((kakao) => {
        if (cancelled) return;
        kakaoRef.current = kakao;
        geocoderRef.current = new kakao.maps.services.Geocoder();
        const start = value?.lat ? value : DEFAULT_CENTER;
        const map = new kakao.maps.Map(mapEl.current, {
          center: new kakao.maps.LatLng(start.lat, start.lng),
          level: 3,
        });
        mapRef.current = map;

        kakao.maps.event.addListener(map, "dragstart", () => {
          setMoving(true);
          setPlaceName("");
        });
        kakao.maps.event.addListener(map, "zoom_start", () => setMoving(true));
        // 지도가 멈추면 가운데 좌표의 주소를 다시 찾는다
        kakao.maps.event.addListener(map, "idle", () => {
          const c = map.getCenter();
          const next = { lat: c.getLat(), lng: c.getLng() };
          setCenter(next);
          setMoving(false);
          reverseGeocode(next);
        });
        // 지도를 누르면 그 지점으로 핀 이동
        kakao.maps.event.addListener(map, "click", (e) => {
          setPlaceName("");
          map.panTo(e.latLng);
        });

        setReady(true);
        reverseGeocode({ lat: start.lat, lng: start.lng });
      })
      .catch((err) => !cancelled && setLoadError(err.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reverseGeocode({ lat, lng }) {
    const geocoder = geocoderRef.current;
    if (!geocoder) return;
    geocoder.coord2Address(lng, lat, (res, status) => {
      if (status !== kakaoRef.current.maps.services.Status.OK || !res[0]) {
        setAddress("주소를 찾을 수 없는 위치예요");
        return;
      }
      const r = res[0];
      setAddress(r.road_address?.address_name || r.address.address_name);
    });
  }

  // 글쓰기 <form> 안에서 열리기 때문에 여기서는 <form>을 쓰지 않는다 (Enter가 글 저장으로 번지지 않게)
  function search() {
    const k = keyword.trim();
    if (!k || !ready) return;
    setSearching(true);
    setSearchMsg("");
    const kakao = kakaoRef.current;
    const places = new kakao.maps.services.Places();
    const c = mapRef.current.getCenter();
    // 지금 보고 있는 지도 근처 결과를 먼저
    places.keywordSearch(
      k,
      (data, status) => {
        if (status === kakao.maps.services.Status.OK) {
          setResults(data.slice(0, 6));
          setSearching(false);
          return;
        }
        // 장소 이름으로 못 찾으면 주소로 한 번 더
        geocoderRef.current.addressSearch(k, (addr, st) => {
          setSearching(false);
          if (st === kakao.maps.services.Status.OK) {
            setResults(
              addr.slice(0, 6).map((a) => ({
                id: `${a.x},${a.y}`,
                place_name: a.address_name,
                address_name: a.road_address?.address_name ?? "",
                x: a.x,
                y: a.y,
              })),
            );
          } else {
            setResults([]);
            setSearchMsg("검색 결과가 없어요. 건물 이름이나 주소로 다시 검색해 보세요.");
          }
        });
      },
      { location: c, sort: kakao.maps.services.SortBy.ACCURACY },
    );
  }

  function pick(place) {
    const kakao = kakaoRef.current;
    mapRef.current.setLevel(2);
    mapRef.current.setCenter(new kakao.maps.LatLng(Number(place.y), Number(place.x)));
    setPlaceName(place.place_name);
    setResults([]);
    setKeyword("");
  }

  function myLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const kakao = kakaoRef.current;
        setPlaceName("");
        mapRef.current.setCenter(new kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude));
      },
      () => setSearchMsg("현재 위치를 가져오지 못했어요. 브라우저 위치 권한을 확인해 주세요."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function confirm() {
    onConfirm({ lat: center.lat, lng: center.lng, address, placeName });
  }

  return createPortal(
    <div className="picker-backdrop" role="dialog" aria-modal="true" aria-label="위치 선택">
      <div className="picker">
        <div className="picker-top">
          <button type="button" className="btn-text picker-close" onClick={onClose} aria-label="닫기">
            ✕
          </button>
          <div className="picker-search">
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  search();
                }
              }}
              placeholder="어디쯤이었나요? 예) 동국대 학생회관, 충무로역"
              autoFocus
            />
            <button type="button" className="btn btn-sm btn-primary" onClick={search} disabled={!ready || searching}>
              {searching ? "…" : "검색"}
            </button>
          </div>
          {searchMsg && <p className="picker-msg">{searchMsg}</p>}
          {results.length > 0 && (
            <ul className="picker-results">
              {results.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => pick(p)}>
                    <strong>{p.place_name}</strong>
                    <span className="muted small">{p.road_address_name || p.address_name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="picker-map-wrap">
          <div ref={mapEl} className="picker-map" />
          {ready && (
            <>
              {/* 지도는 움직이고 핀은 가운데 고정 (카카오T 방식) */}
              <div className={moving ? "center-pin lifting" : "center-pin"} aria-hidden="true">
                <span className="pin-head" />
                <span className="pin-shadow" />
              </div>
              <button type="button" className="my-loc" onClick={myLocation} aria-label="현재 위치로">
                ◎
              </button>
            </>
          )}
          {!ready && !loadError && <p className="picker-loading muted">지도를 불러오는 중…</p>}
          {loadError && <p className="picker-loading error">{loadError}</p>}
        </div>

        <div className="picker-bottom">
          <p className="muted small">지도를 움직이거나 눌러서 핀을 정확한 위치에 맞춰주세요</p>
          <div className="picker-address">
            {placeName && <strong>{placeName}</strong>}
            <span>{moving ? "위치 찾는 중…" : address || "—"}</span>
          </div>
          <button type="button" className="btn btn-primary btn-block" onClick={confirm} disabled={!ready || moving || !address}>
            이 위치로 할게요
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
