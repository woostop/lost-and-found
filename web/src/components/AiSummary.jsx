export default function AiSummary({ summary }) {
  if (!summary) return null;
  const rows = [
    ["물품", summary.item_name],
    ["색상", summary.color],
    ["장소", summary.location],
    ["카테고리", summary.category],
  ].filter(([, v]) => v);

  return (
    <div className="ai-card">
      <div className="ai-card-title">✨ AI 정리</div>
      <dl className="ai-list">
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {summary.features?.length > 0 && (
        <div className="features">
          {summary.features.map((f) => (
            <span key={f} className="chip static">{f}</span>
          ))}
        </div>
      )}
    </div>
  );
}
