import { Link } from "react-router-dom";
import { imageUrl } from "../lib/supabase.js";
import { TYPE_LABEL, timeAgo } from "../lib/constants.js";

export default function ItemCard({ item }) {
  const src = imageUrl(item.image_path);
  const resolved = item.status === "resolved";
  return (
    <Link to={`/items/${item.id}`} className={`item-card card${resolved ? " is-resolved" : ""}`}>
      <div className="thumb">
        {src ? <img src={src} alt="" loading="lazy" /> : <span className="thumb-empty">{item.category}</span>}
        {resolved && <span className="resolved-badge">찾았어요</span>}
      </div>
      <div className="item-body">
        <div className="badges">
          <span className={`badge badge-${item.type}`}>{TYPE_LABEL[item.type]}</span>
          <span className="badge">{item.category}</span>
        </div>
        <h3 className="item-title">{item.title}</h3>
        <p className="item-meta muted">
          {[item.location, timeAgo(item.created_at)].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  );
}
