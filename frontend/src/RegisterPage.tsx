import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "./auth";
import "./Auth.css";

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(username.trim(), email.trim(), password);
      navigate("/");
    } catch (err: any) {
      setError(err?.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">注册</h1>
        {error && <div className="auth-error">{error}</div>}
        <div className="auth-field">
          <label>用户名</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="auth-field">
          <label>邮箱</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="auth-field">
          <label>密码（至少 6 位）</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="auth-actions">
          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "注册中..." : "注册"}
          </button>
          <Link className="auth-link" to="/login">
            已有账号？去登录
          </Link>
        </div>
      </form>
    </div>
  );
};

export default RegisterPage;
