import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import { CATEGORIES, PAGE_SIZE, errorText } from "../lib/constants.js";
import ItemCard from "../components/ItemCard.jsx";

const TYPE_TABS = [
  { value: "", label: "전체" },
  { value: "lost", label: "잃어버렸어요" },
  { value: "found", label: "주웠어요" },
];

export default function ListPage() {
  const { user } = useAuth();
  // 필터는 URL에 담아서 상세 → 뒤로가기 해도 유지되게
  const [params, setParams] = useSearchParams();
  const type = params.get("type") ?? "";
  const category = params.get("category") ?? "";
  const q = params.get("q") ?? "";
  const showResolved = params.get("resolved") === "1";
  const mine = params.get("mine") === "1";

  const [search, setSearch] = useState(q);
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function setParam(key, value) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
    setPage(0);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      let query = supabase
        .from("items")
        .select("id, type, title, category, location, image_path, status, created_at")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE); // 1개 더 받아서 다음 페이지 여부 확인
      if (type) query = query.eq("type", type);
      if (category) query = query.eq("category", category);
      if (!showResolved) query = query.eq("status", "open");
      if (mine && user) query = query.eq("user_id", user.id);
      if (q) {
        const k = q.replace(/[,()%*]/g, " ").trim();
        if (k) query = query.or(`title.ilike.%${k}%,description.ilike.%${k}%,location.ilike.%${k}%`);
      }
      const { data, error } = await query;
      if (cancelled) return;
      if (error) {
        setError(errorText(error));
      } else {
        const rows = data.slice(0, PAGE_SIZE);
        setItems((prev) => (page === 0 ? rows : [...prev, ...rows]));
        setHasMore(data.length > PAGE_SIZE);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [type, category, q, showResolved, mine, user, page]);

  return (
    <div>
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", search.trim());
        }}
      >
        <input
          type="search"
          placeholder="물건, 장소로 검색 (예: 에어팟, 도서관)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="btn">검색</button>
      </form>

      <div className="tabs tabs-pill">
        {TYPE_TABS.map((t) => (
          <button key={t.value} className={type === t.value ? "tab active" : "tab"} onClick={() => setParam("type", t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="chips">
        <button className={!category ? "chip active" : "chip"} onClick={() => setParam("category", "")}>
          전체
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} className={category === c ? "chip active" : "chip"} onClick={() => setParam("category", c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="toggles">
        <label className="check">
          <input type="checkbox" checked={showResolved} onChange={(e) => setParam("resolved", e.target.checked ? "1" : "")} />
          해결된 글도 보기
        </label>
        {user && (
          <label className="check">
            <input type="checkbox" checked={mine} onChange={(e) => setParam("mine", e.target.checked ? "1" : "")} />
            내 글만
          </label>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {!loading && items.length === 0 && !error && (
        <div className="empty card">
          <p>아직 글이 없어요.</p>
          <p className="muted">{q || type || category ? "필터를 바꿔보세요." : "첫 글을 올려보세요!"}</p>
        </div>
      )}

      <div className="grid">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>

      {loading && <p className="muted center">불러오는 중…</p>}
      {!loading && hasMore && (
        <button className="btn btn-block more" onClick={() => setPage((p) => p + 1)}>
          더 보기
        </button>
      )}
    </div>
  );
}
