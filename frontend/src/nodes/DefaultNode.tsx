import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Handle, NodeResizer, Position, useReactFlow, useUpdateNodeInternals } from "reactflow";
import type { NodeProps } from "reactflow";
import { marked } from "marked";
import DOMPurify from "dompurify";
import "./DefaultNode.css";

type Port = { id: string; label: string };

export type NodeData = {
  label: string;
  nodeType: string;
  config: Record<string, unknown>;
  inputs?: Port[];
  outputs?: Port[];
  status?: "idle" | "running" | "success" | "error";
  lastOutput?: string;
  lastThinking?: string;
  lastAnswer?: string;
  lastBlocks?: Array<{ format: "text" | "markdown" | "code"; value: string }>;
  lastImages?: string[];
  lastImageValues?: Array<unknown>;
  variant?: string;
  badge?: string;
  preview?: string;
};

const statusColor: Record<string, string> = {
  idle: "#94a3b8",
  running: "#eab308",
  success: "#22c55e",
  error: "#f43f5e",
};

const resolveTextOutput = (data: NodeData) => {
  const fallback = String(data.config?.value ?? "");
  if (!data.lastOutput) return fallback;
  try {
    const parsed = JSON.parse(data.lastOutput);
    if (parsed && typeof parsed === "object") {
      if ("out" in parsed) return String((parsed as any).out ?? "");
      if ("text" in parsed) return String((parsed as any).text ?? "");
      return JSON.stringify(parsed, null, 2);
    }
    return String(parsed ?? "");
  } catch {
    return data.lastOutput;
  }
};

const renderBlock = (block: { format: "text" | "markdown" | "code"; value: string }) => {
  if (block.format === "markdown") {
    const html = DOMPurify.sanitize(marked.parse(block.value) as string);
    return (
      <div
        className="preview-body output-markdown nodrag"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  if (block.format === "code") {
    return (
      <pre className="preview-body output-code nodrag">
        <code>{block.value}</code>
      </pre>
    );
  }
  return <div className="preview-body output-text nodrag">{block.value}</div>;
};

const getPrimaryFormat = (data: NodeData) => {
  const sources = (data.config?.inputSources as Array<Record<string, any>>) || [];
  const first = sources[0];
  const format = first?.format;
  if (format === "markdown" || format === "code" || format === "text") return format;
  return "text";
};

// 根据图片数量拆分行：最多5列，优先保证前排更满，避免孤立一张
const splitImageRows = (images: string[]) => {
  const n = images.length;
  const preset: Record<number, number[]> = {
    1: [1],
    2: [2],
    3: [2, 1],
    4: [2, 2],
    5: [3, 2],
    6: [3, 3],
  };
  if (n <= 6) {
    const copied = [...images];
    const layout = preset[n];
    if (layout) {
      const res: string[][] = [];
      let idx = 0;
      layout.forEach((count) => {
        res.push(copied.slice(idx, idx + count));
        idx += count;
      });
      return res;
    }
    return copied.map((i) => [i]);
  }

  const rows: number[] = [];
  let remaining = n;
  while (remaining > 5) {
    rows.push(3);
    remaining -= 3;
  }
  if (remaining === 1 && rows.length > 0) {
    rows[rows.length - 1] -= 1;
    remaining += 1; // => 2
  }
  const tailMap: Record<number, number[]> = {
    2: [2],
    3: [3],
    4: [2, 2],
    5: [3, 2],
  };
  rows.push(...(tailMap[remaining] ?? [remaining]));

  const copied = [...images];
  const result: string[][] = [];
  let idx = 0;
  rows.forEach((count) => {
    result.push(copied.slice(idx, idx + count));
    idx += count;
  });
  return result;
};

function DefaultNode(props: NodeProps<NodeData>) {
  const { id, data, selected } = props;
  const { setNodes, getNode } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const GRID_SIZE = 20;
  const snapSize = (value: number) => Math.max(GRID_SIZE, Math.round(value / GRID_SIZE) * GRID_SIZE);

  const inputs = data.inputs || [];
  const outputs = data.outputs || [];
  const rowCount = Math.max(inputs.length, outputs.length);
  const isTextOutput = data.nodeType === "text-output";
  const isImageOutput = data.nodeType === "image-output";
  const badgeText =
    data.badge || (data.nodeType === "http" ? String(data.config?.method || "POST") : "");
  const rows = useMemo(() => {
    return Array.from({ length: rowCount }).map((_, idx) => ({
      input: inputs[idx],
      output: outputs[idx],
      index: idx,
    }));
  }, [inputs, outputs, rowCount]);

  const hasTextOutput = data.nodeType === "text-output";
  const hasImageOutput = data.nodeType === "image-output";
  const hasImageInput = data.nodeType === "image-input";
  const isLLM = ["llm", "llm-file", "llm-generic", "doubao-1-8"].includes(data.nodeType);
  // 检测是否是 Doubao-Seed-1.8 模型（需要分离显示 Thinking 和 Answer）
  const model = String(data.config?.model || "");
  const isDoubaoSeed = isLLM && /doubao-seed-1-8/i.test(model);
  
  // 折叠状态管理（默认折叠）
  const [thinkingCollapsed, setThinkingCollapsed] = useState(true);
  const [answerCollapsed, setAnswerCollapsed] = useState(true);
  const blocks = data.lastBlocks || [];
  const fallbackFormat = getPrimaryFormat(data);
  const sources = (data.config?.inputSources as Array<Record<string, any>>) || [];
  const displayCount = Math.max(1, sources.length);
  const images = data.lastImages || [];
  const imageRows = useMemo(() => splitImageRows(images), [images]);
  const inputImages = useMemo(() => {
    if (!hasImageInput) return [];
    const cfgImages = (data.config?.images as string[]) || [];
    return cfgImages;
  }, [hasImageInput, data.config?.images]);
  const inputImageRows = useMemo(() => splitImageRows(inputImages), [inputImages]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState<number>(-1);
  const [baseScale, setBaseScale] = useState(1);
  const [previewState, setPreviewState] = useState({
    scale: 1,
    flipped: false,
    offsetX: 0,
    offsetY: 0,
  });
  const dragState = useRef<{
    dragging: boolean;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  }>({ dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });

  const closePreview = () => {
    setPreviewUrl(null);
    setPreviewImageIndex(-1);
    setPreviewState({ scale: 1, flipped: false, offsetX: 0, offsetY: 0 });
    setBaseScale(1);
    dragState.current.dragging = false;
  };

  const allImages = useMemo(() => {
    if (hasImageInput) return inputImages;
    if (hasImageOutput) return images;
    return [];
  }, [hasImageInput, hasImageOutput, inputImages, images]);

  const openPreview = (src: string) => {
    const index = allImages.indexOf(src);
    setPreviewUrl(src);
    setPreviewImageIndex(index >= 0 ? index : -1);
    setPreviewState({ scale: 1, flipped: false, offsetX: 0, offsetY: 0 });
    setBaseScale(1);
  };

  const navigatePreview = useCallback(
    (direction: "prev" | "next") => {
      if (previewImageIndex < 0 || allImages.length === 0) return;
      let newIndex = previewImageIndex;
      if (direction === "prev") {
        newIndex = previewImageIndex > 0 ? previewImageIndex - 1 : allImages.length - 1;
      } else {
        newIndex = previewImageIndex < allImages.length - 1 ? previewImageIndex + 1 : 0;
      }
      setPreviewImageIndex(newIndex);
      setPreviewUrl(allImages[newIndex]);
      setPreviewState({ scale: 1, flipped: false, offsetX: 0, offsetY: 0 });
      setBaseScale(1);
    },
    [previewImageIndex, allImages],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current.dragging) return;
      const dx = e.clientX - dragState.current.startX;
      const dy = e.clientY - dragState.current.startY;
      setPreviewState((prev) => ({ ...prev, offsetX: dragState.current.baseX + dx, offsetY: dragState.current.baseY + dy }));
    };
    const handleMouseUp = () => {
      dragState.current.dragging = false;
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!previewUrl || previewImageIndex < 0 || allImages.length <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        navigatePreview("prev");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        navigatePreview("next");
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewUrl, previewImageIndex, allImages.length, navigatePreview]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, updateNodeInternals, data.lastOutput, data.lastBlocks, data.lastImages, data.inputs, inputImages]);

  // 当 Doubao-Seed 节点的折叠状态改变时，自动调整节点高度（基于内容自适应）
  useEffect(() => {
    if (!isDoubaoSeed) return;
    const currentHeight = (getNode(id)?.style as any)?.height;
    if (currentHeight === undefined || currentHeight === null) return;
    // 清除显式高度，让 React Flow 基于内容重新测量
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        if (!n.style || (n.style as any)?.height === undefined) return n;
        const { height: _omit, ...rest } = (n.style || {}) as Record<string, unknown>;
        return { ...n, style: rest };
      }),
    );
    requestAnimationFrame(() => updateNodeInternals(id));
  }, [
    id,
    isDoubaoSeed,
    thinkingCollapsed,
    answerCollapsed,
    data.lastThinking,
    data.lastAnswer,
    rowCount,
    setNodes,
    updateNodeInternals,
    getNode,
  ]);

  useEffect(() => {
    if (!isTextOutput && !isImageOutput && !hasImageInput) return;
    const currentHeight = (getNode(id)?.style as any)?.height;
    if (currentHeight === undefined || currentHeight === null) return;
    setNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        if (n.id !== id) return n;
        const height = (n.style as any)?.height;
        if (height === undefined || height === null) return n;
        const { height: _omit, ...rest } = (n.style || {}) as Record<string, unknown>;
        changed = true;
        return { ...n, style: rest };
      });
      return changed ? next : nds;
    });
  }, [id, isTextOutput, isImageOutput, hasImageInput, setNodes, inputImages.length]);

  const previewOverlay =
    previewUrl && typeof window !== "undefined"
      ? createPortal(
          <div className="image-preview-overlay" onClick={closePreview}>
            <div
              className="image-preview-body"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => {
                dragState.current = {
                  dragging: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  baseX: previewState.offsetX,
                  baseY: previewState.offsetY,
                };
              }}
            >
              {allImages.length > 1 && previewImageIndex >= 0 && (
                <>
                  <button
                    className="image-preview-nav image-preview-nav-left"
                    type="button"
                    title="上一张"
                    aria-label="上一张"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigatePreview("prev");
                    }}
                  >
                    ←
                  </button>
                  <button
                    className="image-preview-nav image-preview-nav-right"
                    type="button"
                    title="下一张"
                    aria-label="下一张"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigatePreview("next");
                    }}
                  >
                    →
                  </button>
                </>
              )}
              <div className="image-preview-content">
                <img
                  src={previewUrl || ""}
                  alt="preview"
                  onLoad={(e) => {
                    const naturalW = e.currentTarget.naturalWidth || 1;
                    const naturalH = e.currentTarget.naturalHeight || 1;
                    const neededScale = Math.max(1, 800 / naturalW, 800 / naturalH);
                    setBaseScale(neededScale);
                  }}
                  style={{
                    transform: `translate(${previewState.offsetX}px, ${previewState.offsetY}px) scale(${
                      previewState.flipped ? -(previewState.scale * baseScale) : previewState.scale * baseScale
                    }, ${previewState.scale * baseScale})`,
                    cursor: dragState.current.dragging ? "grabbing" : "grab",
                  }}
                  draggable={false}
                />
              </div>
              <div className="image-preview-actions">
                <button
                  type="button"
                  title="翻转"
                  aria-label="翻转"
                  onClick={() =>
                    setPreviewState((prev) => ({ ...prev, flipped: !prev.flipped }))
                  }
                >
                  ↺
                </button>
                <button
                  type="button"
                  title="缩小"
                  aria-label="缩小"
                  onClick={() =>
                    setPreviewState((prev) => ({
                      ...prev,
                      scale: Math.max(0.2, +(prev.scale - 0.2).toFixed(2)),
                    }))
                  }
                >
                  ➖
                </button>
                <button
                  type="button"
                  title="放大"
                  aria-label="放大"
                  onClick={() =>
                    setPreviewState((prev) => ({
                      ...prev,
                      scale: Math.min(5, +(prev.scale + 0.2).toFixed(2)),
                    }))
                  }
                >
                  ➕
                </button>
                <a
                  className="image-preview-btn"
                  title="下载"
                  aria-label="下载"
                  href={previewUrl || ""}
                  download
                  target="_blank"
                  rel="noreferrer"
                >
                  ⭳
                </a>
                <button
                  type="button"
                  title="重置"
                  aria-label="重置"
                  onClick={() =>
                    setPreviewState({ scale: 1, flipped: false, offsetX: 0, offsetY: 0 })
                  }
                >
                  ⟳
                </button>
                <button type="button" title="关闭" aria-label="关闭" onClick={closePreview}>
                  ✕
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={cardRef}
        className={`node-card variant-${data.variant || "generic"} ${selected ? "selected" : ""}`}
      >
      <NodeResizer
        isVisible={selected}
        minWidth={180}
        minHeight={80}
        handleClassName="node-resize-handle"
        onResize={() => updateNodeInternals(id)}
        onResizeEnd={(_, params) => {
          const width = snapSize(params.width);
          const height = snapSize(params.height);
          setNodes((nds) =>
            nds.map((n) =>
              n.id === id
                ? isTextOutput || isImageOutput || hasImageInput
                  ? { ...n, style: { ...(n.style || {}), width } }
                  : { ...n, style: { ...(n.style || {}), width, height } }
                : n,
            ),
          );
          requestAnimationFrame(() => updateNodeInternals(id));
        }}
      />
      <div className="node-header">
        <div className="node-title">
          <span className="node-icon" />
          <span>{data.label || data.nodeType}</span>
        </div>
        <div className="node-actions">
          {badgeText && <span className="node-badge">{badgeText}</span>}
          {data.status && (
            <span
              className="status-dot"
              style={{ background: statusColor[data.status] || "#94a3b8" }}
            />
          )}
        </div>
      </div>

      {rowCount > 0 && (
        <div className="node-rows">
          {rows.map((row) => (
            <div className="node-row" key={`${id}-row-${row.index}`}>
              {row.input && (
                <Handle
                  id={`in-${row.input.id}`}
                  type="target"
                  position={Position.Left}
                  className="handle input row-handle"
                />
              )}
              <span className="row-left">{row.input?.label || ""}</span>
              <span className="row-right">{row.output?.label || ""}</span>
              {row.output && (
                <Handle
                  id={`out-${row.output.id}`}
                  type="source"
                  position={Position.Right}
                  className="handle output row-handle"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {data.nodeType !== "text-output" &&
        data.nodeType !== "image-output" &&
        data.nodeType !== "image-input" && (
        <>
          {isDoubaoSeed ? (
            <>
              {data.lastThinking && (
                <div className={`node-preview nodrag node-preview-doubao ${thinkingCollapsed ? "collapsed" : ""}`}>
                  <div 
                    className="preview-title preview-title-collapsible" 
                    onClick={() => setThinkingCollapsed(!thinkingCollapsed)}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <span>Thinking</span>
                    <span style={{ marginLeft: "8px", fontSize: "10px" }}>
                      {thinkingCollapsed ? "▶" : "▼"}
                    </span>
                  </div>
                  {!thinkingCollapsed && (
                    <div className="preview-body nodrag preview-body-streaming preview-body-doubao">
                      {data.lastThinking}
                    </div>
                  )}
                </div>
              )}
              {data.lastAnswer && (
                <div className={`node-preview nodrag node-preview-doubao ${answerCollapsed ? "collapsed" : ""}`}>
                  <div 
                    className="preview-title preview-title-collapsible" 
                    onClick={() => setAnswerCollapsed(!answerCollapsed)}
                    style={{ cursor: "pointer", userSelect: "none" }}
                  >
                    <span>Answer</span>
                    <span style={{ marginLeft: "8px", fontSize: "10px" }}>
                      {answerCollapsed ? "▶" : "▼"}
                    </span>
                  </div>
                  {!answerCollapsed && (
                    <div className="preview-body nodrag preview-body-streaming preview-body-doubao">
                      {data.lastAnswer}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            data.lastOutput && (
              <div className="node-preview nodrag">
                <div className="preview-title">Output</div>
                <div className={`preview-body nodrag ${isLLM ? "preview-body-streaming" : ""}`}>
                  {data.lastOutput}
                </div>
              </div>
            )
          )}
        </>
      )}

      {hasTextOutput && (
        <div className="text-output-list">
          {Array.from({ length: displayCount }).map((_, idx) => {
            const source = sources[idx] || {};
            const block = blocks[idx];
            const format =
              source.format === "markdown" || source.format === "code" || source.format === "text"
                ? source.format
                : "text";
            const value =
              block?.value ??
              (idx === 0 ? resolveTextOutput(data) : "");
            return (
              <div key={`${id}-block-${idx}`} className="node-preview nodrag">
                <div className="preview-title">{`Output ${idx + 1}`}</div>
                {renderBlock({
                  format: format || fallbackFormat,
                  value: value || "",
                })}
              </div>
            );
          })}
        </div>
      )}

      {hasImageOutput && (
        <div className="image-output-list">
          <div className="node-preview nodrag">
            <div className="preview-title">Output</div>
            {images.length === 0 ? (
              <div className="preview-body output-text nodrag">暂无图片</div>
            ) : (
              <div className="image-grid">
                {(() => {
                  const maxCols = Math.max(...imageRows.map((r) => Math.max(r.length, 1)), 1);
                  const gapPx = 8; // 与 CSS .image-row gap 保持一致
                  const widthCalc = `calc((100% - ${(maxCols - 1) * gapPx}px) / ${maxCols})`;
                  return imageRows.map((row, rowIndex) => (
                    <div className="image-row" key={`${id}-image-row-${rowIndex}`}>
                      {row.map((src, idx) => (
                        <div
                          className="image-item"
                          style={{ width: widthCalc, flex: `0 0 ${widthCalc}` }}
                          key={`${id}-image-${rowIndex}-${idx}`}
                        >
                          <img
                            src={src}
                            alt={`image-${rowIndex}-${idx}`}
                            onClick={() => openPreview(src)}
                          />
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {hasImageInput && (
        <div className="image-input-list">
          <div className="node-preview nodrag">
            <div className="preview-title">Images</div>
            {inputImages.length === 0 ? (
              <div className="preview-body output-text nodrag">暂无图片，可上传或粘贴图片</div>
            ) : (
              <div className="image-grid">
                {(() => {
                  const maxCols = Math.max(...inputImageRows.map((r) => Math.max(r.length, 1)), 1);
                  const gapPx = 8;
                  const widthCalc = `calc((100% - ${(maxCols - 1) * gapPx}px) / ${maxCols})`;
                  return inputImageRows.map((row, rowIndex) => (
                    <div className="image-row" key={`${id}-input-image-row-${rowIndex}`}>
                      {row.map((src, idx) => {
                        const globalIdx = inputImageRows.slice(0, rowIndex).reduce((sum, r) => sum + r.length, 0) + idx;
                        return (
                          <div
                            className="image-item image-item-input"
                            style={{ width: widthCalc, flex: `0 0 ${widthCalc}` }}
                            key={`${id}-input-image-${rowIndex}-${idx}`}
                          >
                            <img
                              src={src}
                              alt={`input-image-${rowIndex}-${idx}`}
                              onClick={() => openPreview(src)}
                            />
                            <button
                              className="image-item-delete"
                              type="button"
                              title="删除"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newImages = inputImages.filter((_, i) => i !== globalIdx);
                                setNodes((nds) =>
                                  nds.map((n) =>
                                    n.id === id
                                      ? {
                                          ...n,
                                          data: {
                                            ...n.data,
                                            config: { ...n.data.config, images: newImages },
                                          },
                                        }
                                      : n,
                                  ),
                                );
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      {previewOverlay}
    </>
  );
}

export default memo(DefaultNode);
