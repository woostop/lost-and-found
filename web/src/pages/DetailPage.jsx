import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BUCKET, imageUrl, supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import { TYPE_LABEL, errorText, formatDate, timeAgo } from "../lib/constants.js";
import AiSummary from "../components/AiSummary.jsx";
import StaticMap from "../components/StaticMap.jsx";

export default function DetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("items")
      .select("*, profiles(nickname)")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(errorText(error));
        setItem(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) return <p className="muted center">불러오는 중…</p>;
  if (!item) return <p className="muted center">{error || "글을 찾을 수 없어요."}</p>;

  const isOwner = user?.id === item.user_id;
  const resolved = item.status === "resolved";
  const src = imageUrl(item.image_path);

  async function toggleResolved() {
    setBusy(true);
    setError("");
    const next = resolved ? "open" : "resolved";
    const { data, error } = await supabase.from("items").update({ status: next }).eq("id", id).select("status");
    setBusy(false);
    if (error || !data?.length) return setError(error ? errorText(error) : "변경 권한이 없어요.");
    setItem((it) => ({ ...it, status: next }));
  }

  async function remove() {
    if (!confirm("이 글을 삭제할까요? 되돌릴 수 없어요.")) return;
    setBusy(true);
    setError("");
    const { data, error } = await supabase.from("items").delete().eq("id", id).select("id");
    if (error || !data?.length) {
      setBusy(false);
      return setError(error ? errorText(error) : "삭제 권한이 없어요.");
    }
    if (item.image_path) await supabase.storage.from(BUCKET).remove([item.image_path]);
    navigate("/", { replace: true });
  }

  return (
    <article className="detail">
      <button className="back btn-text" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
        ← 목록
      </button>

      {src && (
        <div className="detail-image">
          <img src={src} alt={item.title} />
        </div>
      )}

      <div className="card detail-card">
        <div className="badges">
          <span className={`badge badge-${item.type}`}>{TYPE_LABEL[item.type]}</span>
          <span className="badge">{item.category}</span>
          {resolved && <span className="badge badge-resolved">찾았어요 ✓</span>}
        </div>
        <h1 className="detail-title">{item.title}</h1>
        <p className="muted small">
          {item.profiles?.nickname ?? "알 수 없음"} · {timeAgo(item.created_at)}
        </p>

        <dl className="info">
          {item.location && (
            <div>
              <dt>장소</dt>
              <dd>{item.location}</dd>
            </div>
          )}
          {item.occurred_at && (
            <div>
              <dt>{item.type === "lost" ? "잃어버린 날" : "주운 날"}</dt>
              <dd>{formatDate(item.occurred_at)}</dd>
            </div>
          )}
        </dl>

        {item.lat != null && item.lng != null && <StaticMap lat={item.lat} lng={item.lng} label={item.title} />}

        {item.description && <p className="description">{item.description}</p>}

        <AiSummary summary={item.ai_summary} />

        {error && <p className="error">{error}</p>}

        {isOwner && (
          <div className="actions">
            <button className={resolved ? "btn" : "btn btn-success"} onClick={toggleResolved} disabled={busy}>
              {resolved ? "다시 찾는 중으로" : "찾았어요 ✓"}
            </button>
            <Link to={`/items/${id}/edit`} className="btn">수정</Link>
            <button className="btn btn-danger" onClick={remove} disabled={busy}>삭제</button>
          </div>
        )}
      </div>
    </article>
  );
}
