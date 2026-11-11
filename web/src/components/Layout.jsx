import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { supabase } from "../lib/supabase.js";

export default function Layout() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  async function logout() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            <span className="logo-mark">?</span> 찾아줘
          </Link>
          <nav className="nav">
            {user ? (
              <>
                <span className="muted nickname">{profile?.nickname ?? ""}님</span>
                <button className="btn-text" onClick={logout}>로그아웃</button>
                <Link to="/new" className="btn btn-primary btn-sm">글쓰기</Link>
              </>
            ) : (
              <Link to="/login" className="btn btn-primary btn-sm">로그인</Link>
            )}
          </nav>
        </div>
      </header>
      <main className="container main">
        <Outlet />
      </main>
    </>
  );
}
