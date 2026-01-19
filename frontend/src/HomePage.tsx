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

const HomePage = () => {
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

  const handleShare = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      const res = await apiFetch(`/workflows/${id}`);
      if (!res.ok) throw new Error("Failed to fetch workflow");
      const workflow = await res.json();
      const payload = {
        name: workflow.name,
        nodes: workflow.nodes,
        edges: workflow.edges,
      };
      const text = JSON.stringify(payload, null, 2);
      // 尝试使用现代剪切板 API，失败时使用 fallback
      try {
        await navigator.clipboard.writeText(text);
        alert("已复制到剪切板");
      } catch {
        // Fallback: 使用传统方式复制
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        alert("已复制到剪切板");
      }
    } catch (err) {
      console.error("Error sharing workflow:", err);
      alert("分享失败：" + (err instanceof Error ? err.message : "未知错误"));
    }
  };

  const handleImportShare = async () => {
    // 尝试使用剪切板 API，失败时弹出输入框
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // 剪切板 API 在 HTTP 环境下不可用，使用 prompt 让用户手动粘贴
      const input = prompt("请粘贴分享的工作流数据（JSON格式）：");
      if (!input) return;
      text = input;
    }
    
    try {
      const payload = JSON.parse(text || "{}");
      if (!payload || !Array.isArray(payload.nodes) || !Array.isArray(payload.edges)) {
        alert("内容不是有效的分享数据，请确保粘贴完整的JSON格式数据");
        return;
      }
      const name = typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : "导入项目";
      const res = await apiFetch("/workflows", {
        method: "POST",
        body: JSON.stringify({
          name,
          nodes: payload.nodes,
          edges: payload.edges,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to import workflow");
      }
      const importedWorkflow = await res.json();
      await fetchWorkflows();
      // 导入成功后，自动打开新创建的工作流
      if (importedWorkflow && importedWorkflow.id) {
        navigate(`/workflow/${importedWorkflow.id}`);
      }
    } catch (err) {
      console.error("Error importing workflow:", err);
      alert("导入失败");
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
          <div className="lang-select-wrapper">
            <span className="lang-icon">🌐</span>
            <select className="lang-select">
              <option>简体中文</option>
            </select>
          </div>
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

      <div className="home-main">
        <div className="home-hero">
          <h1 className="hero-title">
            <span className="hero-logo">爆单</span>工作流
          </h1>
          <p className="hero-subtitle">你的工作好帮手</p>
          <div className="hero-input-box">
            <button className="input-attach">📎</button>
            <input
              type="text"
              className="hero-input"
              placeholder=""
            />
            <div className="input-actions">
              <button className="input-action-btn">🔍</button>
              <button className="input-action-btn">⚡</button>
              <button className="input-action-btn">🌐</button>
              <button className="input-action-btn">📦</button>
              <button className="input-action-btn">⬆️</button>
            </div>
          </div>
        </div>

        <div className="home-projects">
          <div className="projects-header">
            <h2 className="projects-title">最近项目</h2>
            <div className="projects-actions">
              <button className="projects-view-all" onClick={handleImportShare}>
                导入分享
              </button>
              <button
                className="projects-view-all"
                onClick={() => navigate("/projects")}
              >
                查看全部 &gt;
              </button>
            </div>
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
              workflows.slice(0, 8).map((workflow) => (
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
                      <div
                        className="project-name"
                        onClick={(e) => handleStartRename(workflow, e)}
                      >
                        {workflow.name || "未命名"}
                      </div>
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
                        handleCopy(workflow.id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="复制"
                    >
                      📋
                    </button>
                    <button
                      type="button"
                      className="project-action-btn"
                      onClick={(e) => handleShare(workflow.id, e)}
                      onMouseDown={(e) => e.stopPropagation()}
                      title="分享"
                    >
                      🔗
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

export default HomePage;
