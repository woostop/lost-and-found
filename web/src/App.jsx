import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import ListPage from "./pages/ListPage.jsx";
import DetailPage from "./pages/DetailPage.jsx";
import ItemFormPage from "./pages/ItemFormPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { useAuth } from "./lib/auth.jsx";

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p className="muted center">불러오는 중…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<ListPage />} />
        <Route path="/items/:id" element={<DetailPage />} />
        <Route path="/new" element={<RequireAuth><ItemFormPage /></RequireAuth>} />
        <Route path="/items/:id/edit" element={<RequireAuth><ItemFormPage /></RequireAuth>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<p className="muted center">페이지를 찾을 수 없어요.</p>} />
      </Route>
    </Routes>
  );
}
