import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import "./Auth.css";

type CreditLog = {
  id: string;
  type: "consume" | "admin_add";
  amount: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
};

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState(user?.profile?.avatarUrl || "");
  const [bio, setBio] = useState(user?.profile?.bio || "");
  const [username, setUsername] = useState(user?.username || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setAvatarUrl(user.profile?.avatarUrl || "");
    setBio(user.profile?.bio || "");
    setUsername(user.username);
  }, [user]);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const res = await apiFetch("/users/me/credits/logs");
        if (!res.ok) return;
        const data = await res.json();
        setLogs(data.items || []);
      } catch {
        // ignore
      }
    };
    loadLogs();
  }, []);

  const handleSaveProfile = async () => {
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch("/users/me", {
        method: "PUT",
        body: JSON.stringify({ username, avatarUrl, bio }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUser(data.user || null);
      setMessage("资料已更新");
    } catch (err: any) {
      setError(err?.message || "更新失败");
    }
  };

  const handleChangePassword = async () => {
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch("/users/me/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, nextPassword }),
      });
      if (!res.ok) throw new Error(await res.text());
      setCurrentPassword("");
      setNextPassword("");
      setMessage("密码已更新");
    } catch (err: any) {
      setError(err?.message || "修改失败");
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-section">
          <h3>个人信息</h3>
          {message && <div className="auth-error" style={{ color: "#166534", borderColor: "#bbf7d0", background: "#f0fdf4" }}>{message}</div>}
          {error && <div className="auth-error">{error}</div>}
          <div className="profile-grid">
            <div className="auth-field">
              <label>头像 URL</label>
              <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>用户名</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>简介</label>
              <input value={bio} onChange={(e) => setBio(e.target.value)} />
            </div>
          </div>
          <div className="auth-actions" style={{ alignItems: "flex-start" }}>
            <button className="auth-btn" type="button" onClick={handleSaveProfile}>
              保存资料
            </button>
            <button className="auth-link" type="button" onClick={() => navigate("/")}>
              返回首页
            </button>
          </div>
        </div>

        <div className="profile-section">
          <h3>修改密码</h3>
          <div className="profile-grid">
            <div className="auth-field">
              <label>当前密码</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label>新密码</label>
              <input
                type="password"
                value={nextPassword}
                onChange={(e) => setNextPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="auth-actions" style={{ alignItems: "flex-start" }}>
            <button className="auth-btn" type="button" onClick={handleChangePassword}>
              更新密码
            </button>
          </div>
        </div>

        <div className="profile-section">
          <h3>积分概览</h3>
          <div className="profile-list">
            <div className="profile-log">剩余积分：{user?.credits ?? 0}</div>
            <div className="profile-log">已使用积分：{user?.usedCredits ?? 0}</div>
          </div>
        </div>

        <div className="profile-section">
          <h3>积分消耗记录</h3>
          <div className="profile-list">
            {logs.length === 0 && <div className="profile-log">暂无记录</div>}
            {logs.map((log) => (
              <div key={log.id} className="profile-log">
                {new Date(log.createdAt).toLocaleString("zh-CN")} · {log.reason} · {log.amount} · 余额 {log.balanceAfter}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
