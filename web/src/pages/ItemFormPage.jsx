import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { BUCKET, imageUrl, supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import { CATEGORIES, TYPE_LABEL, errorText } from "../lib/constants.js";
import { extOf, shrinkImage } from "../lib/image.js";
import AiSummary from "../components/AiSummary.jsx";
import LocationPicker from "../components/LocationPicker.jsx";
import StaticMap from "../components/StaticMap.jsx";
import { KAKAO_KEY } from "../lib/kakao.js";

const EMPTY = {
  type: "lost",
  title: "",
  description: "",
  category: "기타",
  location: "",
  lat: null,
  lng: null,
  occurred_at: new Date().toISOString().slice(0, 10),
};

export default function ItemFormPage() {
  const { id } = useParams(); // 있으면 수정 모드
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [original, setOriginal] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!!id);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 수정 모드: 기존 글 불러오기
  useEffect(() => {
    if (!id) return;
    supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setError("글을 찾을 수 없어요.");
        } else if (data.user_id !== user.id) {
          setError("내 글만 수정할 수 있어요.");
        } else {
          setOriginal(data);
          setForm({
            type: data.type,
            title: data.title,
            description: data.description ?? "",
            category: data.category,
            location: data.location ?? "",
            lat: data.lat,
            lng: data.lng,
            occurred_at: data.occurred_at ?? "",
          });
          setAiSummary(data.ai_summary);
          setPreview(imageUrl(data.image_path));
        }
        setLoading(false);
      });
  }, [id, user.id]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // 지도에서 고른 위치 반영: 건물 이름이 있으면 "건물 (주소)", 없으면 주소
  function applyLocation({ lat, lng, address, placeName }) {
    setForm((f) => ({
      ...f,
      lat,
      lng,
      location: placeName ? `${placeName} (${address})` : address,
    }));
    setPickerOpen(false);
  }

  function clearLocation() {
    setForm((f) => ({ ...f, lat: null, lng: null }));
  }

  async function runAi() {
    if (!form.description.trim()) {
      setAiError("설명을 먼저 적어주세요. 대충 써도 괜찮아요!");
      return;
    }
    setAiBusy(true);
    setAiError("");
    const { data, error } = await supabase.functions.invoke("ai-summarize", {
      body: { description: form.description, title: form.title, location: form.location, type: form.type },
    });
    setAiBusy(false);
    if (error || !data?.summary) {
      setAiError("AI 정리에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    const s = data.summary;
    setAiSummary(s);
    // 추천값 반영: 카테고리는 항상, 비어있는 칸만 채움
    setForm((f) => ({
      ...f,
      category: s.category,
      location: f.location || s.location,
      title: f.title || [s.color, s.item_name].filter(Boolean).join(" "),
    }));
  }

  async function uploadPhoto(itemId) {
    const small = await shrinkImage(file);
    if (small.size > 5 * 1024 * 1024) throw new Error("사진 용량이 너무 커요 (최대 5MB).");
    const path = `${user.id}/${itemId}-${Date.now()}.${extOf(small)}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, small, { contentType: small.type });
    if (error) throw error;
    return path;
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    let createdId = null;
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        location: form.location.trim() || null,
        occurred_at: form.occurred_at || null,
        ai_summary: aiSummary,
      };

      let itemId = id;
      if (id) {
        const { error } = await supabase.from("items").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("items")
          .insert({ ...payload, user_id: user.id })
          .select("id")
          .single();
        if (error) throw error;
        itemId = data.id;
        createdId = data.id;
      }

      if (file) {
        const path = await uploadPhoto(itemId);
        const { error } = await supabase.from("items").update({ image_path: path }).eq("id", itemId);
        if (error) throw error;
        if (original?.image_path) await supabase.storage.from(BUCKET).remove([original.image_path]);
      }

      navigate(`/items/${itemId}`, { replace: true });
    } catch (err) {
      if (createdId) {
        // 글은 저장됐고 사진만 실패 → 중복 글이 생기지 않게 수정 화면으로 보냄
        alert(`${errorText(err)}\n글은 저장됐어요. 수정 화면에서 사진을 다시 올려주세요.`);
        navigate(`/items/${createdId}/edit`, { replace: true });
        return;
      }
      setError(errorText(err));
      setSaving(false);
    }
  }

  if (loading) return <p className="muted center">불러오는 중…</p>;
  if (error && id && !original) return <p className="error center">{error}</p>;

  return (
    <form className="form card form-page" onSubmit={submit}>
      <h1 className="page-title">{id ? "글 수정" : "분실물 글쓰기"}</h1>

      <div className="segmented">
        {Object.entries(TYPE_LABEL).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={form.type === value ? `seg active seg-${value}` : "seg"}
            onClick={() => set("type", value)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>설명</span>
        <textarea
          rows={5}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={2000}
          placeholder="대충 써도 돼요. 예) 어제 저녁 학생회관 2층 화장실 근처에서 검은 가죽 반지갑 잃어버림, 학생증이랑 카드 2장 있음"
        />
      </label>

      <div className="ai-row">
        <button type="button" className="btn btn-ai" onClick={runAi} disabled={aiBusy}>
          {aiBusy ? "AI가 정리하는 중…" : "✨ AI로 정리하기"}
        </button>
        <span className="muted small">물품명·색상·장소·특징을 뽑고 카테고리를 추천해요</span>
      </div>
      {aiError && <p className="error">{aiError}</p>}
      {aiSummary && <AiSummary summary={aiSummary} />}

      <label className="field">
        <span>제목</span>
        <input value={form.title} onChange={(e) => set("title", e.target.value)} required maxLength={100} placeholder="예) 검은색 가죽 반지갑" />
      </label>

      <div className="row-2">
        <label className="field">
          <span>카테고리</span>
          <select value={form.category} onChange={(e) => set("category", e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{form.type === "lost" ? "잃어버린 날" : "주운 날"}</span>
          <input type="date" value={form.occurred_at} onChange={(e) => set("occurred_at", e.target.value)} />
        </label>
      </div>

      <div className="field">
        <span>장소</span>
        <div className="location-row">
          <input
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="예) 학생회관 2층"
            aria-label="장소"
          />
          {KAKAO_KEY && (
            <button type="button" className="btn" onClick={() => setPickerOpen(true)}>
              📍 지도에서 찾기
            </button>
          )}
        </div>
        {form.lat != null && (
          <div className="location-preview">
            <StaticMap lat={form.lat} lng={form.lng} label={form.title || form.location} />
            <button type="button" className="btn-text small" onClick={clearLocation}>
              지도 위치 빼기
            </button>
          </div>
        )}
        <em className="muted small">상세 위치(층, 호실 등)는 장소 칸에 덧붙여 적어도 돼요</em>
      </div>
      {pickerOpen && (
        <LocationPicker
          value={form.lat != null ? { lat: form.lat, lng: form.lng, address: form.location } : null}
          onConfirm={applyLocation}
          onClose={() => setPickerOpen(false)}
        />
      )}

      <label className="field">
        <span>사진 <em className="muted">(선택, 1장)</em></span>
        <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      {preview && <img src={preview} alt="미리보기" className="preview" />}

      {error && <p className="error">{error}</p>}

      <div className="actions">
        <button type="button" className="btn" onClick={() => navigate(-1)}>
          취소
        </button>
        <button className="btn btn-primary" disabled={saving}>
          {saving ? "저장 중…" : id ? "수정 완료" : "올리기"}
        </button>
      </div>
    </form>
  );
}
