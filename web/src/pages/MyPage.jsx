import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import { errorText, formatDate } from "../lib/constants.js";
import ItemCard from "../components/ItemCard.jsx";

const STATUS_TABS = [
  { value: "open", label: "찾는 중" },
  { value: "resolved", label: "해결됨" },
];

export default function MyPage() {
  const { user, profile, setProfile } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("open");

  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const { data, error } = await supabase
        .from("items")
        .select("id, type, title, category, location, image_path, status, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) setError(errorText(error));
      else setItems(data);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  function startEdit() {
    setNickname(profile?.nickname ?? "");
    setSaveError("");
    setEditing(true);
  }

  async function saveNickname(e) {
    e.preventDefault();
    const value = nickname.trim();
    if (!value) {
      setSaveError("닉네임을 입력해 주세요.");
      return;
    }
    setSaving(true);
    setSaveError("");
    const { data, error } = await supabase
      .from("profiles")
      .update({ nickname: value })
      .eq("id", user.id)
      .select()
      .single();
    setSaving(false);
    if (error) {
      setSaveError(errorText(error));
      return;
    }
    setProfile(data);
    setEditing(false);
  }

  const counts = {
    total: items.length,
    lost: items.filter((i) => i.type === "lost").length,
    found: items.filter((i) => i.type === "found").length,
    resolved: items.filter((i) => i.status === "resolved").length,
  };
  const shown = items.filter((i) => i.status === tab);
  const name = profile?.nickname || user.email.split("@")[0];

  return (
    <div className="my-page">
      <section className="card profile-card">
        <div className="avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </div>
        <div className="profile-info">
          {editing ? (
            <form className="nickname-form" onSubmit={saveNickname}>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                autoFocus
                aria-label="닉네임"
              />
              <button className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? "저장 중…" : "저장"}
              </button>
              <button type="button" className="btn btn-sm" onClick={() => setEditing(false)}>
                취소
              </button>
            </form>
          ) : (
            <div className="profile-name">
              <h1>{name}</h1>
              <button className="btn-text" onClick={startEdit}>
                닉네임 수정
              </button>
            </div>
          )}
          {saveError && <p className="error">{saveError}</p>}
          <p className="muted small">{user.email}</p>
          <p className="muted small">가입일 {formatDate(profile?.created_at ?? user.created_at)}</p>
        </div>
      </section>

      <section className="stats">
        <div className="stat card">
          <strong>{counts.total}</strong>
          <span className="muted">전체 글</span>
        </div>
        <div className="stat card">
          <strong className="text-lost">{counts.lost}</strong>
          <span className="muted">잃어버렸어요</span>
        </div>
        <div className="stat card">
          <strong className="text-found">{counts.found}</strong>
          <span className="muted">주웠어요</span>
        </div>
        <div className="stat card">
          <strong>{counts.resolved}</strong>
          <span className="muted">해결됨</span>
        </div>
      </section>

      <section>
        <div className="section-head">
          <h2>내가 쓴 글</h2>
          <Link to="/new" className="btn btn-primary btn-sm">
            글쓰기
          </Link>
        </div>

        <div className="tabs tabs-pill">
          {STATUS_TABS.map((t) => (
            <button key={t.value} className={tab === t.value ? "tab active" : "tab"} onClick={() => setTab(t.value)}>
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="error">{error}</p>}
        {loading && <p className="muted center">불러오는 중…</p>}

        {!loading && !error && shown.length === 0 && (
          <div className="empty card">
            <p>{tab === "open" ? "찾는 중인 글이 없어요." : "아직 해결된 글이 없어요."}</p>
            {tab === "open" && <p className="muted">물건을 잃어버렸거나 주웠다면 글을 올려보세요.</p>}
          </div>
        )}

        <div className="grid">
          {shown.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
