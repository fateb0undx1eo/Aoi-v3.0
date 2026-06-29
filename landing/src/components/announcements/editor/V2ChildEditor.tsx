import { useState, useRef } from "react";
import { Plus, X, Image, FileText, Type, LayoutGrid, Minus } from "lucide-react";
import { BUTTON_STYLES } from "../constants";
import type { APIButtonComponent, APIV2ChildComponent, APIV2Thumbnail, ButtonStyle, MediaGalleryItem, UnfurledMediaItem } from "../types";
import { randomId } from "../utils/message";
import { getPlacement } from "../utils/placement";

const TYPE_LABELS: Record<number, { label: string; icon: string; color: string }> = {
  10: { label: "Text Display", icon: "T", color: "#6366f1" },
  12: { label: "Media Gallery", icon: "🖼", color: "#22c55e" },
  13: { label: "File", icon: "📄", color: "#f59e0b" },
  14: { label: "Separator", icon: "—", color: "#6b7280" },
  9:  { label: "Section", icon: "§", color: "#a855f7" },
  1:  { label: "Action Row", icon: "≡", color: "#3b82f6" },
  17: { label: "Container", icon: "▣", color: "#ec4899" },
};

function TypeBadge({ type }: { type: number }) {
  const info = TYPE_LABELS[type];
  if (!info) return null;
  return (
    <span style={{ fontSize: 9, fontWeight: 600, color: info.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {info.label}
    </span>
  );
}

export default function V2ChildEditor({ child, onChange, onRemove }: {
  child: APIV2ChildComponent;
  onChange: (c: APIV2ChildComponent) => void;
  onRemove: () => void;
}) {
  const [sectionAccOpen, setSectionAccOpen] = useState(false);
  const [accPlacement, setAccPlacement] = useState<"above" | "below">("above");
  const accBtnRef = useRef<HTMLButtonElement>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const ctype = child.type as number;

  const outerStyle: React.CSSProperties = {
    borderRadius: 6,
    border: "1px solid #27272a",
    backgroundColor: "#000",
    padding: 8,
    position: "relative",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  };

  const removeBtn = (
    <button type="button" onClick={onRemove} style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", lineHeight: 1 }}>
      <X size={12} />
    </button>
  );

  if (child.type === 10) {
    return (
      <div style={outerStyle}>
        <div style={headerStyle}>
          <TypeBadge type={10} />
          <span style={{ fontSize: 10, color: "#52525b" }}>{child.content?.length ?? 0}/4000</span>
          {removeBtn}
        </div>
        <textarea value={child.content} onChange={(e) => onChange({ ...child, content: e.target.value })}
          placeholder="Markdown text content..." rows={3} maxLength={4000}
          style={{
            width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
            color: "#e4e4e7", fontSize: 12, padding: "6px 8px", resize: "vertical",
            outline: "none", fontFamily: "inherit", lineHeight: 1.5,
          }} />
      </div>
    );
  }

  if (child.type === 12) {
    const items = child.items || [];
    const updateItem = (ii: number, upd: { media?: UnfurledMediaItem; description?: string; spoiler?: boolean }) => {
      const next = [...items];
      next[ii] = { ...next[ii], ...upd } as MediaGalleryItem;
      onChange({ ...child, items: next });
    };
    const removeItem = (ii: number) => {
      onChange({ ...child, items: items.filter((_, i) => i !== ii) });
    };
    const addItem = () => {
      onChange({ ...child, items: [...items, { media: { url: "" } }] });
    };
    return (
      <div style={outerStyle}>
        <div style={headerStyle}>
          <TypeBadge type={12} />
          <span style={{ fontSize: 10, color: "#52525b" }}>{items.length}/10 items</span>
          {removeBtn}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((item, ii) => (
            <div key={ii} style={{ borderRadius: 4, border: "1px solid #18181b", padding: 6, backgroundColor: "#09090b" }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: item.description || item.spoiler ? 4 : 0 }}>
                {item.media?.url && (
                  <img src={item.media.url} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: "cover", flexShrink: 0, border: "1px solid #27272a" }}
                    onError={(e) => { (e.target as HTMLElement).style.display = "none"; }} />
                )}
                <input type="text" value={item.media?.url || ""}
                  onChange={(e) => updateItem(ii, { media: { url: e.target.value } })}
                  placeholder="Image URL..." style={{
                    flex: 1, minWidth: 0, borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                    color: "#e4e4e7", fontSize: 11, padding: "4px 6px", outline: "none",
                  }} />
                <button type="button" onClick={() => removeItem(ii)}
                  style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}><X size={10} /></button>
              </div>
              {(item.description != null || item.spoiler) && (
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                  <input type="text" value={item.description || ""}
                    onChange={(e) => updateItem(ii, { description: e.target.value || undefined })}
                    placeholder="Description (alt text)..." style={{
                      flex: 1, borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                      color: "#e4e4e7", fontSize: 10, padding: "3px 6px", outline: "none",
                    }} />
                  <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#71717a", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={item.spoiler || false}
                      onChange={(e) => updateItem(ii, { spoiler: e.target.checked || undefined })}
                      style={{ width: 10, height: 10 }} />
                    Spoiler
                  </label>
                </div>
              )}
            </div>
          ))}
          {items.length < 10 && (
            <button type="button" onClick={addItem}
              style={{
                width: "100%", padding: "4px 0", fontSize: 9, textTransform: "uppercase",
                color: "#71717a", background: "none", border: "1px dashed #27272a",
                borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 4,
              }}>
              <Plus size={10} /> Add Media
            </button>
          )}
        </div>
      </div>
    );
  }

  if (child.type === 13) {
    return (
      <div style={outerStyle}>
        <div style={headerStyle}>
          <TypeBadge type={13} />
          {removeBtn}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <input type="text" value={child.file?.url || ""}
            onChange={(e) => onChange({ ...child, file: { url: e.target.value } })}
            placeholder="File URL (attachment://filename)..." style={{
              flex: 1, borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
              color: "#e4e4e7", fontSize: 11, padding: "5px 8px", outline: "none",
            }} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#71717a" }}>
          <input type="checkbox" checked={child.spoiler || false}
            onChange={(e) => onChange({ ...child, spoiler: e.target.checked || undefined })}
            style={{ width: 11, height: 11 }} />
          Spoiler
        </label>
      </div>
    );
  }

  if (child.type === 14) {
    return (
      <div style={{ ...outerStyle, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px" }}>
        <div style={{ flex: 1, height: 1, backgroundColor: "#27272a" }} />
        <span style={{ fontSize: 9, color: "#71717a", whiteSpace: "nowrap" }}>Separator</span>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#71717a" }}>
            <input type="checkbox" checked={child.divider ?? true}
              onChange={(e) => onChange({ ...child, divider: e.target.checked })}
              style={{ width: 10, height: 10 }} />
            Divider
          </label>
          <select value={child.spacing ?? 1}
            onChange={(e) => onChange({ ...child, spacing: Number(e.target.value) as 1 | 2 })}
            style={{
              borderRadius: 3, border: "1px solid #27272a", backgroundColor: "#111",
              color: "#a1a1aa", fontSize: 9, padding: "2px 4px", outline: "none",
            }}>
            <option value={1}>Small</option>
            <option value={2}>Large</option>
          </select>
        </div>
        <div style={{ flex: 1, height: 1, backgroundColor: "#27272a" }} />
        {removeBtn}
      </div>
    );
  }

  if (child.type === 9) {
    const textChildren = child.components || [];
    const addTextChild = () => {
      if (textChildren.length >= 3) return;
      onChange({ ...child, components: [...textChildren, { type: 10 as const, content: "" }] });
    };
    const updateTextChild = (ti: number, content: string) => {
      const updated = textChildren.map((tc, i) => i === ti ? { ...tc, content } : tc);
      onChange({ ...child, components: updated });
    };
    const removeTextChild = (ti: number) => {
      if (textChildren.length <= 1) return;
      onChange({ ...child, components: textChildren.filter((_, i) => i !== ti) });
    };

    const accessory = child.accessory;
    const isButtonAcc = accessory?.type === 2 || (!accessory?.type && false);
    const isThumbAcc = accessory?.type === 11;

    return (
      <div style={{ ...outerStyle, borderLeft: `3px solid #a855f7` }}>
        <div style={headerStyle}>
          <TypeBadge type={9} />
          <span style={{ fontSize: 10, color: "#52525b" }}>{textChildren.length}/3 text blocks</span>
          {removeBtn}
        </div>
        {/* Text children */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
          {textChildren.map((tc, ti) => (
            <div key={ti} style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
              <textarea value={tc.content || ""}
                onChange={(e) => updateTextChild(ti, e.target.value)}
                placeholder={`Text block ${ti + 1}...`} rows={2} maxLength={2000}
                style={{
                  flex: 1, borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                  color: "#e4e4e7", fontSize: 11, padding: "4px 6px", resize: "none",
                  outline: "none", fontFamily: "inherit", lineHeight: 1.4,
                }} />
              {textChildren.length > 1 && (
                <button type="button" onClick={() => removeTextChild(ti)}
                  style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: "4px 0 0 0", display: "flex" }}>
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          {textChildren.length < 3 && (
            <button type="button" onClick={addTextChild}
              style={{
                width: "100%", padding: "3px 0", fontSize: 9, textTransform: "uppercase",
                color: "#71717a", background: "none", border: "1px dashed #27272a",
                borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 4,
              }}>
              <Plus size={10} /> Add Text Block
            </button>
          )}
        </div>
        {/* Accessory section */}
        <div style={{ borderTop: "1px solid #18181b", paddingTop: 6 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Accessory</span>
            <div style={{ position: "relative" }}>
              <button ref={accBtnRef} type="button" onClick={() => {
                if (!sectionAccOpen && accBtnRef.current) setAccPlacement(getPlacement(accBtnRef.current));
                setSectionAccOpen(!sectionAccOpen);
              }} style={{
                fontSize: 9, padding: "3px 8px", borderRadius: 4,
                border: "1px solid #27272a", background: "#111",
                color: "#a1a1aa", cursor: "pointer",
              }}>
                {accessory ? (isButtonAcc ? "Edit Button" : isThumbAcc ? "Edit Thumbnail" : "Edit") : "+ Add"}
              </button>
              {sectionAccOpen && (
                <div style={{
                  position: "absolute", right: 0, zIndex: 20, width: 200,
                  borderRadius: 6, border: "1px solid #27272a",
                  backgroundColor: "#18181b", padding: 8, boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
                  ...(accPlacement === "above" ? { bottom: "100%", marginBottom: 4 } : { top: "100%", marginTop: 4 }),
                }}>
                  {!accessory && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <button type="button" onClick={() => {
                        onChange({ ...child, accessory: { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}` } } as any);
                        setSectionAccOpen(false);
                      }} style={{
                        padding: "6px 8px", fontSize: 10, textAlign: "left",
                        color: "#a1a1aa", background: "none", border: "none",
                        borderRadius: 4, cursor: "pointer",
                      }}>Button</button>
                      <button type="button" onClick={() => {
                        onChange({ ...child, accessory: { type: 11, media: { url: "" } } } as any);
                        setSectionAccOpen(false);
                      }} style={{
                        padding: "6px 8px", fontSize: 10, textAlign: "left",
                        color: "#a1a1aa", background: "none", border: "none",
                        borderRadius: 4, cursor: "pointer",
                      }}>Thumbnail</button>
                    </div>
                  )}
                  {accessory?.type === 2 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 9, color: "#71717a", textTransform: "uppercase" }}>Button Accessory</span>
                      <input type="text" value={(accessory as APIButtonComponent).label || ""}
                        onChange={(e) => onChange({ ...child, accessory: { ...accessory, label: e.target.value || undefined } } as any)}
                        placeholder="Label" style={{
                          width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                          color: "#e4e4e7", fontSize: 10, padding: "4px 6px", outline: "none",
                        }} />
                      {(accessory as APIButtonComponent).style === 5 ? (
                        <input type="text" value={(accessory as APIButtonComponent).url || ""}
                          onChange={(e) => onChange({ ...child, accessory: { ...accessory, url: e.target.value } } as any)}
                          placeholder="URL" style={{
                            width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                            color: "#e4e4e7", fontSize: 10, padding: "4px 6px", outline: "none",
                          }} />
                      ) : (
                        <input type="text" value={(accessory as APIButtonComponent).custom_id || ""}
                          onChange={(e) => onChange({ ...child, accessory: { ...accessory, custom_id: e.target.value } } as any)}
                          placeholder="Custom ID" style={{
                            width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                            color: "#e4e4e7", fontSize: 10, padding: "4px 6px", outline: "none",
                          }} />
                      )}
                      <input type="text" value={(accessory as APIButtonComponent).emoji ? ((accessory as APIButtonComponent).emoji!.name || (accessory as APIButtonComponent).emoji!.id || "") : ""}
                        onChange={(e) => onChange({ ...child, accessory: { ...accessory, emoji: e.target.value ? { name: e.target.value } : undefined } } as any)}
                        placeholder="Emoji (name or id)" style={{
                          width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                          color: "#e4e4e7", fontSize: 10, padding: "4px 6px", outline: "none",
                        }} />
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#71717a" }}>
                        <input type="checkbox" checked={(accessory as APIButtonComponent).disabled || false}
                          onChange={(e) => onChange({ ...child, accessory: { ...accessory, disabled: e.target.checked || undefined } } as any)}
                          style={{ width: 10, height: 10 }} />
                        Disabled
                      </label>
                      <select value={(accessory as APIButtonComponent).style}
                        onChange={(e) => onChange({ ...child, accessory: { ...accessory, style: Number(e.target.value) as ButtonStyle } } as any)}
                        style={{
                          width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                          color: "#a1a1aa", fontSize: 10, padding: "4px 6px", outline: "none",
                        }}>
                        {[1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>{BUTTON_STYLES[s]?.label || s}</option>)}
                      </select>
                      <button type="button" onClick={() => onChange({ ...child, accessory: undefined } as any)}
                        style={{
                          padding: "4px 8px", fontSize: 9, borderRadius: 4,
                          border: "none", background: "rgba(239,68,68,0.15)", color: "#ef4444",
                          cursor: "pointer", marginTop: 4,
                        }}>Remove</button>
                    </div>
                  )}
                  {accessory?.type === 11 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 9, color: "#71717a", textTransform: "uppercase" }}>Thumbnail Accessory</span>
                      <input type="text" value={(accessory as APIV2Thumbnail).media?.url || ""}
                        onChange={(e) => onChange({ ...child, accessory: { type: 11, media: { url: e.target.value }, description: (accessory as APIV2Thumbnail).description, spoiler: (accessory as APIV2Thumbnail).spoiler } } as any)}
                        placeholder="Image URL..." style={{
                          width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                          color: "#e4e4e7", fontSize: 10, padding: "4px 6px", outline: "none",
                        }} />
                      <input type="text" value={(accessory as APIV2Thumbnail).description || ""}
                        onChange={(e) => onChange({ ...child, accessory: { ...accessory, description: e.target.value || undefined } } as any)}
                        placeholder="Description (alt text)" style={{
                          width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
                          color: "#e4e4e7", fontSize: 10, padding: "4px 6px", outline: "none",
                        }} />
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#71717a" }}>
                        <input type="checkbox" checked={(accessory as APIV2Thumbnail).spoiler || false}
                          onChange={(e) => onChange({ ...child, accessory: { ...accessory, spoiler: e.target.checked || undefined } } as any)}
                          style={{ width: 10, height: 10 }} />
                        Spoiler
                      </label>
                      <button type="button" onClick={() => onChange({ ...child, accessory: undefined } as any)}
                        style={{
                          padding: "4px 8px", fontSize: 9, borderRadius: 4,
                          border: "none", background: "rgba(239,68,68,0.15)", color: "#ef4444",
                          cursor: "pointer", marginTop: 4,
                        }}>Remove</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {accessory && (
            <div style={{
              borderRadius: 4, backgroundColor: "#09090b", border: "1px solid #18181b",
              padding: "4px 8px", fontSize: 10, color: "#a1a1aa",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {isButtonAcc && <span>Button: {(accessory as APIButtonComponent).label || "unnamed"}</span>}
              {isThumbAcc && <span>Thumbnail: {(accessory as APIV2Thumbnail).media?.url?.slice(0, 30) || "no URL"}</span>}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (child.type === 1) {
    const items = child.components || [];
    const hasSelect = items.some(i => i.type !== 2);
    const hasButtons = items.some(i => i.type === 2);

    const updateItem = (ii: number, upd: Record<string, unknown>) => {
      const next = [...items];
      next[ii] = { ...next[ii], ...upd } as any;
      onChange({ ...child, components: next as any });
    };
    const removeItem = (ii: number) => {
      if (editingIndex === ii) setEditingIndex(null);
      onChange({ ...child, components: items.filter((_, i) => i !== ii) as any });
    };

    const inlineInputStyle: React.CSSProperties = {
      width: "100%", borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#111",
      color: "#e4e4e7", fontSize: 10, padding: "3px 6px", outline: "none",
    };
    const inlineLabelStyle: React.CSSProperties = {
      display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: "#71717a",
    };

    return (
      <div style={outerStyle}>
        <div style={headerStyle}>
          <TypeBadge type={1} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {editingIndex !== null && (
              <button type="button" onClick={() => setEditingIndex(null)}
                style={{ fontSize: 9, color: "#71717a", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Done
              </button>
            )}
            <span style={{ fontSize: 10, color: "#52525b" }}>{items.length} items</span>
          </div>
          {removeBtn}
        </div>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "8px 0", fontSize: 9, color: "#52525b" }}>
            Empty row — add buttons or select menus below
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 4 }}>
            {items.map((item, ii) => (
              <div key={ii}>
                {editingIndex === ii ? (
                  <div style={{
                    borderRadius: 4, border: "1px solid #27272a", backgroundColor: "#09090b",
                    padding: 6, display: "flex", flexDirection: "column", gap: 4,
                  }}>
                    {item.type === 2 ? (
                      <>
                        {/* Premium button — show sku_id, hide label/emoji */}
                        {item.style === 6 ? (
                          <input type="text" value={item.sku_id || ""}
                            onChange={(e) => updateItem(ii, { sku_id: e.target.value })}
                            placeholder="SKU ID" style={inlineInputStyle} />
                        ) : (
                          <>
                            <input type="text" value={item.label || ""}
                              onChange={(e) => updateItem(ii, { label: e.target.value })}
                              placeholder="Button label" style={inlineInputStyle} />
                            {item.style === 5 ? (
                              <input type="text" value={item.url || ""}
                                onChange={(e) => updateItem(ii, { url: e.target.value })}
                                placeholder="URL" style={inlineInputStyle} />
                            ) : (
                              <input type="text" value={item.custom_id || ""}
                                onChange={(e) => updateItem(ii, { custom_id: e.target.value })}
                                placeholder="Custom ID" style={inlineInputStyle} />
                            )}
                            <input type="text" value={item.emoji ? (item.emoji.name || item.emoji.id || "") : ""}
                              onChange={(e) => updateItem(ii, { emoji: e.target.value ? { name: e.target.value } : undefined })}
                              placeholder="Emoji (name or id)" style={inlineInputStyle} />
                            <label style={inlineLabelStyle}>
                              <input type="checkbox" checked={item.disabled || false}
                                onChange={(e) => updateItem(ii, { disabled: e.target.checked || undefined })}
                                style={{ width: 10, height: 10 }} />
                              Disabled
                            </label>
                          </>
                        )}
                        <select value={item.style} onChange={(e) => updateItem(ii, { style: Number(e.target.value) })}
                          style={inlineInputStyle}>
                          {[1, 2, 3, 4, 5, 6].map((s) => <option key={s} value={s}>{BUTTON_STYLES[s]?.label || s}</option>)}
                        </select>
                        <button type="button" onClick={() => removeItem(ii)}
                          style={{
                            padding: "3px 8px", fontSize: 9, borderRadius: 4,
                            border: "none", background: "rgba(239,68,68,0.15)", color: "#ef4444",
                            cursor: "pointer",
                          }}>Remove</button>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: 9, color: "#71717a", textTransform: "uppercase" }}>
                          {["String Select","","","User Select","Role Select","Mentionable Select","Channel Select"][item.type - 3] || "Select"}
                        </span>
                        <input type="text" value={item.custom_id || ""}
                          onChange={(e) => updateItem(ii, { custom_id: e.target.value })}
                          placeholder="Custom ID" style={inlineInputStyle} />
                        <input type="text" value={item.placeholder || ""}
                          onChange={(e) => updateItem(ii, { placeholder: e.target.value })}
                          placeholder="Placeholder" style={inlineInputStyle} />
                        {/* String Select options editor */}
                        {item.type === 3 && item.options && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 9, color: "#71717a", textTransform: "uppercase", marginTop: 4 }}>Options ({item.options.length}/25)</span>
                            {item.options.map((opt: any, oi: number) => (
                              <div key={oi} style={{ borderRadius: 4, border: "1px solid #18181b", padding: 6, backgroundColor: "#09090b" }}>
                                <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
                                  <input type="text" value={opt.label || ""}
                                    onChange={(e) => {
                                      const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], label: e.target.value };
                                      updateItem(ii, { options: opts } as any);
                                    }}
                                    placeholder="Label" style={{ ...inlineInputStyle, flex: 1 }} />
                                  <input type="text" value={opt.value || ""}
                                    onChange={(e) => {
                                      const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], value: e.target.value };
                                      updateItem(ii, { options: opts } as any);
                                    }}
                                    placeholder="Value" style={{ ...inlineInputStyle, flex: 1 }} />
                                  <button type="button" onClick={() => {
                                    const opts = item.options.filter((_: any, i: number) => i !== oi);
                                    updateItem(ii, { options: opts } as any);
                                  }} style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                                    <X size={10} />
                                  </button>
                                </div>
                                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                  <input type="text" value={opt.description || ""}
                                    onChange={(e) => {
                                      const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], description: e.target.value || undefined };
                                      updateItem(ii, { options: opts } as any);
                                    }}
                                    placeholder="Description" style={{ ...inlineInputStyle, flex: 1 }} />
                                  <input type="text" value={opt.emoji ? (opt.emoji.name || opt.emoji.id || "") : ""}
                                    onChange={(e) => {
                                      const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], emoji: e.target.value ? { name: e.target.value } : undefined };
                                      updateItem(ii, { options: opts } as any);
                                    }}
                                    placeholder="Emoji" style={{ ...inlineInputStyle, width: 60 }} />
                                  <label style={inlineLabelStyle}>
                                    <input type="checkbox" checked={opt.default || false}
                                      onChange={(e) => {
                                        const opts: any[] = [...item.options]; opts[oi] = { ...opts[oi], default: e.target.checked || undefined };
                                        updateItem(ii, { options: opts } as any);
                                      }}
                                      style={{ width: 10, height: 10 }} />
                                    Default
                                  </label>
                                </div>
                              </div>
                            ))}
                            {item.options.length < 25 && (
                              <button type="button" onClick={() => {
                                const opts: any[] = [...item.options, { label: "", value: "" }];
                                updateItem(ii, { options: opts } as any);
                              }} style={{
                                width: "100%", padding: "3px 0", fontSize: 9, textTransform: "uppercase",
                                color: "#71717a", background: "none", border: "1px dashed #27272a",
                                borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                              }}>
                                <Plus size={10} /> Add Option
                              </button>
                            )}
                          </div>
                        )}
                        {/* Non-String selects — default_values editor */}
                        {item.type >= 5 && item.type <= 8 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 9, color: "#71717a", textTransform: "uppercase", marginTop: 4 }}>Default Values</span>
                            {((item as any).default_values || []).map((dv: any, di: number) => (
                              <div key={di} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                                <input type="text" value={dv.id || ""}
                                  onChange={(e) => {
                                    const dvs: any[] = [...((item as any).default_values || [])]; dvs[di] = { ...dvs[di], id: e.target.value };
                                    updateItem(ii, { default_values: dvs } as any);
                                  }}
                                  placeholder="ID" style={{ ...inlineInputStyle, flex: 1 }} />
                                <select value={dv.type || "user"}
                                  onChange={(e) => {
                                    const dvs: any[] = [...((item as any).default_values || [])]; dvs[di] = { ...dvs[di], type: e.target.value as "user" | "role" | "channel" };
                                    updateItem(ii, { default_values: dvs } as any);
                                  }}
                                  style={{ ...inlineInputStyle, width: 80 }}>
                                  <option value="user">User</option>
                                  <option value="role">Role</option>
                                  <option value="channel">Channel</option>
                                </select>
                                <button type="button" onClick={() => {
                                  const dvs = ((item as any).default_values || []).filter((_: any, i: number) => i !== di);
                                  updateItem(ii, { default_values: (dvs.length > 0 ? dvs : undefined) } as any);
                                }} style={{ color: "#52525b", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
                                  <X size={10} />
                                </button>
                              </div>
                            ))}
                            <button type="button" onClick={() => {
                              const dvs: any[] = [...((item as any).default_values || []), { id: "", type: "user" }];
                              updateItem(ii, { default_values: dvs } as any);
                            }} style={{
                              width: "100%", padding: "3px 0", fontSize: 9, textTransform: "uppercase",
                              color: "#71717a", background: "none", border: "1px dashed #27272a",
                              borderRadius: 4, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                            }}>
                              <Plus size={10} /> Add Default
                            </button>
                          </div>
                        )}
                        {/* All selects — common fields */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                          <label style={{ ...inlineLabelStyle, gap: 3 }}>
                            Min
                            <input type="number" value={item.min_values ?? 0} min={0} max={25}
                              onChange={(e) => updateItem(ii, { min_values: Number(e.target.value) || undefined })}
                              style={{ width: 36, borderRadius: 3, border: "1px solid #27272a", backgroundColor: "#111", color: "#a1a1aa", fontSize: 9, padding: "1px 4px", outline: "none" }} />
                          </label>
                          <label style={{ ...inlineLabelStyle, gap: 3 }}>
                            Max
                            <input type="number" value={item.max_values ?? 1} min={0} max={25}
                              onChange={(e) => updateItem(ii, { max_values: Number(e.target.value) || undefined })}
                              style={{ width: 36, borderRadius: 3, border: "1px solid #27272a", backgroundColor: "#111", color: "#a1a1aa", fontSize: 9, padding: "1px 4px", outline: "none" }} />
                          </label>
                          <label style={inlineLabelStyle}>
                            <input type="checkbox" checked={item.disabled || false}
                              onChange={(e) => updateItem(ii, { disabled: e.target.checked || undefined })}
                              style={{ width: 10, height: 10 }} />
                            Disabled
                          </label>
                          <label style={inlineLabelStyle}>
                            <input type="checkbox" checked={item.required ?? false}
                              onChange={(e) => updateItem(ii, { required: e.target.checked || undefined })}
                              style={{ width: 10, height: 10 }} />
                            Required
                          </label>
                        </div>
                        <button type="button" onClick={() => removeItem(ii)}
                          style={{
                            padding: "3px 8px", fontSize: 9, borderRadius: 4,
                            border: "none", background: "rgba(239,68,68,0.15)", color: "#ef4444",
                            cursor: "pointer",
                          }}>Remove</button>
                      </>
                    )}
                  </div>
                    ) : (
                      <div onClick={() => setEditingIndex(ii)} style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "3px 6px", borderRadius: 4,
                        border: "1px solid #27272a", backgroundColor: "#111",
                        fontSize: 10, color: "#a1a1aa", cursor: "pointer",
                      }}>
                        {item.type === 2 ? (
                          <span>{item.label || "Button"} <span style={{ color: "#52525b" }}>({["Primary","Secondary","Success","Danger","Link","Premium"][(item.style || 1) - 1] || "?"})</span></span>
                        ) : (
                          <span>
                            {["String Select","","","User Select","Role Select","Mentionable Select","Channel Select"][item.type - 3] || "Select"}
                            {item.type === 3 && item.options ? <span style={{ color: "#52525b", marginLeft: 4 }}>({item.options.length} opts)</span> : null}
                            {item.type >= 5 && (item as any).default_values?.length ? <span style={{ color: "#52525b", marginLeft: 4 }}>({(item as any).default_values.length} defaults)</span> : null}
                          </span>
                        )}
                      </div>
                    )}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {!hasSelect && items.length < 5 && (
            <>
              <button type="button" onClick={() => {
                setEditingIndex(null);
                const updated = [...items, { type: 2, style: 1, label: "Button", custom_id: `btn_${randomId()}`, disabled: false }];
                onChange({ ...child, components: updated as any });
              }} style={addBtnStyle}>+Btn</button>
              <button type="button" onClick={() => {
                setEditingIndex(null);
                const updated = [...items, { type: 2, style: 5, label: "Link", url: "https://", disabled: false }];
                onChange({ ...child, components: updated as any });
              }} style={addBtnStyle}>+Link</button>
              <button type="button" onClick={() => {
                setEditingIndex(null);
                const updated = [...items, { type: 2, style: 6, sku_id: "" }];
                onChange({ ...child, components: updated as any });
              }} style={addBtnStyle}>+Premium</button>
            </>
          )}
          {items.length === 0 && !hasButtons && (
            <>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 3, custom_id: `sel_${randomId()}`, placeholder: "Choose", options: [] }];
                onChange({ ...child, components: updated as any });
              }} style={addBtnStyle}>+Select</button>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 5, custom_id: `usr_${randomId()}`, placeholder: "User" }];
                onChange({ ...child, components: updated as any });
              }} style={addBtnStyle}>+User</button>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 6, custom_id: `role_${randomId()}`, placeholder: "Role" }];
                onChange({ ...child, components: updated as any });
              }} style={addBtnStyle}>+Role</button>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 7, custom_id: `ment_${randomId()}`, placeholder: "Mentionable" }];
                onChange({ ...child, components: updated as any });
              }} style={addBtnStyle}>+Mentionable</button>
              <button type="button" onClick={() => {
                const updated = [...items, { type: 8, custom_id: `ch_${randomId()}`, placeholder: "Channel" }];
                onChange({ ...child, components: updated as any });
              }} style={addBtnStyle}>+Channel</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}

const addBtnStyle: React.CSSProperties = {
  padding: "2px 6px", fontSize: 9, borderRadius: 3,
  border: "1px solid #27272a", backgroundColor: "#111",
  color: "#71717a", cursor: "pointer", textTransform: "uppercase",
};
