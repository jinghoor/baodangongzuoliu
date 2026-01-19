import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import type { User } from "./auth";
import "./Auth.css";

type AdminRow = User;

const AdminPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminRow[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const res = await apiFetch("/admin/users");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers(data.items || []);
    } catch (err: any) {
      setError(err?.message || "加载失败");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddCredits = async (targetId: string) => {
    const amount = Number(amounts[targetId] || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("请输入有效的加分数量");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch(`/admin/users/${targetId}/credits`, {
        method: "POST",
        body: JSON.stringify({ amount, reason: "管理员加分" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === targetId ? data.user : u)));
      setAmounts((prev) => ({ ...prev, [targetId]: "" }));
      setMessage("积分已更新");
    } catch (err: any) {
      setError(err?.message || "加分失败");
    }
  };

  const handleRoleChange = async (targetId: string, role: "admin" | "user") => {
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch(`/admin/users/${targetId}/role`, {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === targetId ? data.user : u)));
      setMessage("角色已更新");
    } catch (err: any) {
      setError(err?.message || "更新失败");
    }
  };

  if (user?.role !== "admin") {
    return (
      <div className="admin-page">
        <div className="admin-card">无权限访问</div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-card">
        <div className="profile-section">
          <h3>用户管理</h3>
          {message && (
            <div
              className="auth-error"
              style={{ color: "#166534", borderColor: "#bbf7d0", background: "#f0fdf4" }}
            >
              {message}
            </div>
          )}
          {error && <div className="auth-error">{error}</div>}
          <div className="auth-actions" style={{ alignItems: "flex-start" }}>
            <button className="auth-btn" type="button" onClick={() => navigate("/")}>
              返回首页
            </button>
          </div>
        </div>
        <table className="admin-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>剩余积分</th>
              <th>已用积分</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => (
              <tr key={row.id}>
                <td>{row.username}</td>
                <td>{row.email}</td>
                <td>
                  <select
                    value={row.role}
                    onChange={(e) => handleRoleChange(row.id, e.target.value as "admin" | "user")}
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td>{row.credits}</td>
                <td>{row.usedCredits}</td>
                <td>
                  <div className="admin-actions">
                    <input
                      placeholder="加分"
                      value={amounts[row.id] || ""}
                      onChange={(e) =>
                        setAmounts((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                    <button type="button" onClick={() => handleAddCredits(row.id)}>
                      确认
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6}>暂无用户</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminPage;
