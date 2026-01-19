import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./HomePage.css";
import { apiBase, apiFetch } from "./api";
import { useAuth } from "./auth";

type Workflow = {
  id: string;
  name: string;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
};

const AllProjectsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchWorkflows = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch("/workflows", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch workflows");
      const data = await res.json();
      const items = data.items || [];
      // 按更新时间排序，最新的在前
      const sorted = items.sort(
        (a: Workflow, b: Workflow) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
      setWorkflows(sorted);
    } catch (err) {
      console.error("Error fetching workflows:", err);
      setLoadError(err instanceof Error ? err.message : "无法获取项目列表");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, [location.key]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const handleCreateNew = () => {
    navigate("/workflow");
  };

  const handleOpenWorkflow = (id: string) => {
    navigate(`/workflow/${id}`);
  };

  const handleRename = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      // 先获取完整的工作流
      const res = await apiFetch(`/workflows/${id}`);
      if (!res.ok) throw new Error("Failed to fetch workflow");
      const workflow = await res.json();
      
      // 更新名称
      const updateRes = await apiFetch(`/workflows/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: newName.trim(),
          nodes: workflow.nodes,
          edges: workflow.edges,
        }),
      });
      if (!updateRes.ok) throw new Error("Failed to rename workflow");
      setEditingId(null);
      await fetchWorkflows();
    } catch (err) {
      console.error("Error renaming workflow:", err);
      alert("重命名失败");
    }
  };

  const handleCopy = async (id: string) => {
    try {
      // 获取工作流
      const res = await apiFetch(`/workflows/${id}`);
      if (!res.ok) throw new Error("Failed to fetch workflow");
      const workflow = await res.json();
      
      // 创建副本
      const copyRes = await apiFetch("/workflows", {
        method: "POST",
        body: JSON.stringify({
          name: `${workflow.name} (副本)`,
          nodes: workflow.nodes,
          edges: workflow.edges,
        }),
      });
      if (!copyRes.ok) throw new Error("Failed to copy workflow");
      await fetchWorkflows();
    } catch (err) {
      console.error("Error copying workflow:", err);
      alert("复制失败");
    }
  };

  const handleDeleteClick = (workflow: Workflow, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setDeleteTarget(workflow);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await apiFetch(`/workflows/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "删除失败");
      }
      await fetchWorkflows();
      setDeleteTarget(null);
    } catch (err) {
      console.error("Error deleting workflow:", err);
      alert(`删除失败: ${err instanceof Error ? err.message : "未知错误"}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setDeleteTarget(null);
  };

  const handleStartRename = (workflow: Workflow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(workflow.id);
    setEditingName(workflow.name);
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter") {
      handleRename(id, editingName);
    } else if (e.key === "Escape") {
      handleCancelRename();
    }
  };

  return (
    <div className="home-page">
      <div className="home-header">
        <div className="home-logo" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
          <div className="logo-icon">BD</div>
          <span className="logo-text">爆单工作流</span>
        </div>
        <div className="home-nav">
          <select className="lang-select">
            <option>简体中文</option>
          </select>
          <button className="nav-icon-btn">🔔</button>
          <button className="nav-upgrade-btn">
            ⚡ 积分 <span className="upgrade-points">{user?.credits ?? 0}</span>
          </button>
          <div className="nav-avatar nav-avatar-menu">
            <div className="nav-avatar-circle">👤</div>
            <div className="nav-avatar-dropdown">
              <div className="nav-avatar-name">{user?.username || "未登录"}</div>
              <div className="nav-avatar-email">{user?.email || ""}</div>
              <div className="nav-avatar-actions">
                <Link to="/profile">个人资料</Link>
                {user?.role === "admin" && <Link to="/admin">用户管理</Link>}
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/login");
                  }}
                >
                  退出登录
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="home-main" style={{ paddingTop: "40px" }}>
        <div className="home-projects">
          <div className="projects-header">
            <h2 className="projects-title">所有项目</h2>
            <button 
              className="projects-view-all"
              onClick={() => navigate("/")}
            >
              &lt; 返回首页
            </button>
          </div>
          <div className="projects-grid">
            <div className="project-card new-project" onClick={handleCreateNew}>
              <div className="new-project-icon">+</div>
              <div className="new-project-text">新建项目</div>
            </div>
            {loading ? (
              <div className="project-card loading">加载中...</div>
            ) : loadError ? (
              <div className="project-card empty">加载失败：{loadError}</div>
            ) : workflows.length === 0 ? (
              <div className="project-card empty">暂无项目</div>
            ) : (
              workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="project-card"
                  onClick={() => handleOpenWorkflow(workflow.id)}
                >
                  <div className="project-thumbnail">
                    {workflow.thumbnail ? (
                      <img 
                        src={workflow.thumbnail.startsWith('http') ? workflow.thumbnail : `${apiBase}${workflow.thumbnail.startsWith('/') ? '' : '/'}${workflow.thumbnail}`}
                        alt={workflow.name}
                        className="project-thumbnail-img"
                        onError={(e) => {
                          // 如果图片加载失败，显示占位符
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const placeholder = target.parentElement?.querySelector('.project-placeholder-fallback');
                          if (placeholder) {
                            (placeholder as HTMLElement).style.display = 'flex';
                          }
                        }}
                      />
                    ) : null}
                    {!workflow.thumbnail && <div className="project-placeholder">📊</div>}
                    <div className="project-placeholder project-placeholder-fallback" style={{ display: 'none' }}>📊</div>
                  </div>
                  <div className="project-info">
                    {editingId === workflow.id ? (
                      <input
                        className="project-name-input"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={() => handleRename(workflow.id, editingName)}
                        onKeyDown={(e) => handleKeyDown(e, workflow.id)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <div className="project-name">{workflow.name || "未命名"}</div>
                    )}
                    <div className="project-date">
                      更新于 {formatDate(workflow.updatedAt)}
                    </div>
                  </div>
                  <div 
                    className="project-actions" 
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="project-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleStartRename(workflow, e);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="重命名"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="project-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        handleCopy(workflow.id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="复制"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      className="project-action-btn danger"
                      onClick={(e) => handleDeleteClick(workflow, e)}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {deleteTarget && (
        <div className="modal-backdrop" onClick={handleCancelDelete}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">删除项目</div>
            <div className="modal-content">
              确定要删除“{deleteTarget.name || "未命名"}”吗？此操作不可恢复。
            </div>
            <div className="modal-actions">
              <button className="btn" type="button" onClick={handleCancelDelete} disabled={isDeleting}>
                取消
              </button>
              <button
                className="btn btn-danger"
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllProjectsPage;
