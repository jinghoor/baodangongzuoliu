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

type TemplateWorkflow = Workflow & {
  isTemplate?: boolean;
  templateOrder?: number;
};

const HomePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<TemplateWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Workflow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);


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

  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const res = await apiFetch("/templates", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch templates");
      const data = await res.json();
      const items: TemplateWorkflow[] = data.items || [];
      // 已在后端按 templateOrder 排序，这里再按更新时间做次排序保证稳定性
      const sorted = items.sort(
        (a, b) =>
          (a.templateOrder ?? 0) - (b.templateOrder ?? 0) ||
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
      setTemplates(sorted);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setTemplatesError(err instanceof Error ? err.message : "无法获取热门模版");
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
    fetchTemplates();
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

  // 使用热门模版创建个人项目
  const handleUseTemplate = async (template: TemplateWorkflow) => {
    try {
      // 读取模版详情
      const res = await apiFetch(`/workflows/${template.id}`);
      if (!res.ok) throw new Error("Failed to fetch template");
      const tpl = await res.json();

      // 基于模版创建用户自己的项目
      const createRes = await apiFetch("/workflows", {
        method: "POST",
        body: JSON.stringify({
          name: tpl.name || "基于热门模版的新项目",
          nodes: tpl.nodes || [],
          edges: tpl.edges || [],
          ...(tpl.thumbnail ? { thumbnail: tpl.thumbnail } : {}),
        }),
      });
      if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(text || "Failed to create workflow from template");
      }
      const newWorkflow = await createRes.json();
      // 跳转到新项目编辑页
      if (newWorkflow && newWorkflow.id) {
        navigate(`/workflow/${newWorkflow.id}`);
      } else {
        // 兜底：刷新项目列表
        await fetchWorkflows();
      }
    } catch (err) {
      console.error("Error using template:", err);
      alert("基于热门模版创建项目失败");
    }
  };

  // 管理员：重命名热门模版
  const handleRenameTemplate = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const res = await apiFetch(`/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to rename template");
      await fetchTemplates();
    } catch (err) {
      console.error("Error renaming template:", err);
      alert("重命名热门模版失败");
    }
  };

  // 管理员：删除热门模版
  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm("确定要删除这个热门模版吗？此操作不可恢复。")) return;
    try {
      const res = await apiFetch(`/templates/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to delete template");
      }
      await fetchTemplates();
    } catch (err) {
      console.error("Error deleting template:", err);
      alert("删除热门模版失败");
    }
  };

  // 管理员：新建热门模版
  const handleCreateTemplate = async () => {
    if (creatingTemplate) return;
    setCreatingTemplate(true);
    try {
      const res = await apiFetch("/templates", {
        method: "POST",
        body: JSON.stringify({
          name: "新热门模版",
          nodes: [],
          edges: [],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create template");
      }
      const tpl = await res.json();
      await fetchTemplates();
      if (tpl && tpl.id) {
        navigate(`/workflow/${tpl.id}`);
      }
    } catch (err) {
      console.error("Error creating template:", err);
      alert("新建热门模版失败");
    } finally {
      setCreatingTemplate(false);
    }
  };

  // 管理员：将热门模版置顶（通过调整 templateOrder）
  const handlePinTemplate = async (id: string) => {
    try {
      const current = templates;
      if (!current.length) return;
      const minOrder =
        current.reduce(
          (min, t) => Math.min(min, t.templateOrder ?? 0),
          current[0].templateOrder ?? 0,
        ) || 0;
      const newOrder = minOrder - 1;
      const res = await apiFetch(`/templates/${id}`, {
        method: "PUT",
        body: JSON.stringify({ templateOrder: newOrder }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to reorder template");
      }
      await fetchTemplates();
    } catch (err) {
      console.error("Error pinning template:", err);
      alert("调整热门模版排序失败");
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

        {/* 热门模版区域 */}
        <div className="home-projects">
          <div className="projects-header">
            <h2 className="projects-title">热门模版</h2>
            <div className="projects-actions">
              <span className="projects-subtitle">
                所有用户都可以基于热门模版创建自己的项目
              </span>
              {user?.role === "admin" && (
                <button
                  className="projects-view-all"
                  type="button"
                  onClick={handleCreateTemplate}
                  disabled={creatingTemplate}
                >
                  {creatingTemplate ? "创建中..." : "新建热门模版"}
                </button>
              )}
            </div>
          </div>
          <div className="projects-grid">
            {templatesLoading ? (
              <div className="project-card loading">加载中...</div>
            ) : templatesError ? (
              <div className="project-card empty">加载失败：{templatesError}</div>
            ) : templates.length === 0 ? (
              <div className="project-card empty">暂无热门模版</div>
            ) : (
              templates.slice(0, 8).map((tpl) => (
                <div
                  key={tpl.id}
                  className="project-card"
                  onClick={() => handleUseTemplate(tpl)}
                >
                  <div className="project-thumbnail">
                    {tpl.thumbnail ? (
                      <img
                        src={
                          tpl.thumbnail.startsWith("http")
                            ? tpl.thumbnail
                            : `${apiBase}${tpl.thumbnail.startsWith("/") ? "" : "/"}${tpl.thumbnail}`
                        }
                        alt={tpl.name}
                        className="project-thumbnail-img"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = "none";
                          const placeholder =
                            target.parentElement?.querySelector(".project-placeholder-fallback");
                          if (placeholder) {
                            (placeholder as HTMLElement).style.display = "flex";
                          }
                        }}
                      />
                    ) : null}
                    {!tpl.thumbnail && <div className="project-placeholder">📦</div>}
                    <div
                      className="project-placeholder project-placeholder-fallback"
                      style={{ display: "none" }}
                    >
                      📦
                    </div>
                  </div>
                  <div className="project-info">
                    <div className="project-name">{tpl.name || "未命名模版"}</div>
                    <div className="project-date">更新于 {formatDate(tpl.updatedAt)}</div>
                  </div>
                  {user?.role === "admin" && (
                    <div
                      className="project-actions"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="project-action-btn"
                        title="重命名热门模版"
                        onClick={() => {
                          const name = window.prompt("请输入新的模版名称：", tpl.name);
                          if (name && name.trim()) {
                            handleRenameTemplate(tpl.id, name.trim());
                          }
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        className="project-action-btn"
                        title="置顶此模版"
                        onClick={() => handlePinTemplate(tpl.id)}
                      >
                        📌
                      </button>
                      <button
                        type="button"
                        className="project-action-btn danger"
                        title="删除热门模版"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  )}
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
