import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../lib/auth.jsx";
import { errorText } from "../lib/constants.js";

export default function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from ?? "/";

  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (user) return <Navigate to={from} replace />;

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(from, { replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { nickname: nickname.trim() || undefined },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          navigate(from, { replace: true });
        } else {
          setNotice(`${email}로 인증 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.`);
          setMode("login");
        }
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-box card">
      <div className="tabs">
        <button className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")} type="button">
          로그인
        </button>
        <button className={mode === "signup" ? "tab active" : "tab"} onClick={() => setMode("signup")} type="button">
          회원가입
        </button>
      </div>

      <form onSubmit={submit} className="form">
        <label className="field">
          <span>이메일</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="field">
          <span>비밀번호</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>
        {mode === "signup" && (
          <label className="field">
            <span>닉네임 <em className="muted">(선택, 비우면 이메일 앞부분)</em></span>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={30} />
          </label>
        )}

        {notice && <p className="notice">{notice}</p>}
        {error && <p className="error">{error}</p>}

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? "잠시만요…" : mode === "login" ? "로그인" : "가입하기"}
        </button>
      </form>
    </div>
  );
}
