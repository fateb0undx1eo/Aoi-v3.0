import { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { C } from "./constants";

const ICON_BUTTON = "data:image/svg+xml,%3csvg%20width='100'%20height='100'%20viewBox='0%200%2032%2032'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M28.3448%203.53412C27.7202%202.97867%2026.8731%202.66663%2025.9898%202.66663H6.00688C5.12358%202.66663%204.27646%202.97867%203.65187%203.53412C3.02728%204.08956%202.67639%204.84291%202.67639%205.62843V26.3611C2.67639%2027.1466%203.02728%2027.8999%203.65187%2028.4554C4.27646%2029.0108%205.12358%2029.3229%206.00688%2029.3229H22.4575L21.4554%2023.045C21.3905%2022.6596%2021.3996%2022.226%2021.5416%2021.7968C21.6882%2021.3539%2021.9741%2020.931%2022.4137%2020.6345C22.8532%2020.338%2023.3525%2020.2314%2023.818%2020.2614C24.2692%2020.2905%2024.6745%2020.4445%2025.0075%2020.649L29.3203%2023.2475V5.62843C29.3203%204.84291%2028.9694%204.08956%2028.3448%203.53412ZM9.92744%2023H18.4989V21.3529H9.92744V13.1176H8.49886V21.3529C8.49886%2022.2605%209.13958%2023%209.92744%2023ZM12.7847%209H22.0704C22.8583%209%2023.499%209.73788%2023.499%2010.6471V18.0588C23.499%2018.9664%2022.8583%2019.7059%2022.0704%2019.7059H12.7847C11.9968%2019.7059%2011.3561%2018.9664%2011.3561%2018.0588V10.6471C11.3561%209.73788%2011.9968%209%2012.7847%209Z'%20fill='%23ABABAB'/%3e%3cpath%20d='M29.3203%2025.1353L24.1658%2022.0297C24.0177%2021.9378%2023.8622%2021.8846%2023.7139%2021.875C23.5841%2021.8667%2023.4636%2021.892%2023.3608%2021.9488C23.3461%2021.9569%2023.3318%2021.9657%2023.3179%2021.9751'%20fill='%23ABABAB'/%3e%3cpath%20d='M29.3203%2025.1353L30.1405%2025.6295C30.8985%2026.0887%2031.1896%2027.2073%2030.6425%2027.5763L25.7674%2030.8647C25.2203%2031.2337%2024.2887%2030.5471%2024.1504%2029.6699L23.0509%2022.7818C23.0212%2022.61%2023.0301%2022.4459%2023.0768%2022.3048C23.0768%2022.3048%2023.0767%2022.3048%2023.0768%2022.3048C23.1176%2022.1814%2023.1863%2022.079%2023.2774%2022.005'%20fill='%23ABABAB'/%3e%3c/svg%3e";

const ICON_LINK_BUTTON = "data:image/svg+xml,%3csvg%20width='100'%20height='100'%20viewBox='0%200%2029%2029'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M23.9898%200.666626C24.8731%200.666626%2025.7202%200.978672%2026.3448%201.53412C26.9694%202.08956%2027.3203%202.84291%2027.3203%203.62843V21.2475L23.0075%2018.649C22.6745%2018.4445%2022.2692%2018.2905%2021.818%2018.2614C21.3525%2018.2314%2020.8532%2018.338%2020.4137%2018.6345C19.9741%2018.931%2019.6882%2019.3539%2019.5416%2019.7968C19.3996%2020.226%2019.3905%2020.6596%2019.4554%2021.045L20.4575%2027.3229H4.00688C3.12358%2027.3229%202.27646%2027.0108%201.65187%2026.4554C1.02728%2025.8999%200.676392%2025.1466%200.676392%2024.3611V3.62843C0.676392%202.84291%201.02728%202.08956%201.65187%201.53412C2.27646%200.978672%203.12358%200.666626%204.00688%200.666626H23.9898ZM17.407%2016.3272L17.4078%2016.328C17.6118%2016.5307%2017.8876%2016.6445%2018.1752%2016.6445C18.4628%2016.6445%2018.7388%2016.5306%2018.9427%2016.3279L21.1816%2014.0979L21.1848%2014.0945C22.1823%2013.054%2022.7326%2011.6642%2022.7177%2010.2229C22.7029%208.78162%2022.1242%207.40343%2021.1056%206.38361C20.087%205.3638%2018.7095%204.78347%2017.2682%204.76696C15.8269%204.75045%2014.4365%205.29904%2013.3948%206.29526L11.1472%208.54278L11.1422%208.54864C10.9639%208.75687%2010.8707%209.02471%2010.8813%209.29865C10.8919%209.57258%2011.0054%209.83244%2011.1993%2010.0263C11.3931%2010.2201%2011.653%2010.3337%2011.9269%2010.3443C12.2009%2010.3549%2012.4687%2010.2617%2012.6769%2010.0834L12.6827%2010.0785L14.9244%207.8456C15.5571%207.2587%2016.3926%206.93977%2017.2556%206.9559C18.1196%206.97206%2018.9437%207.32289%2019.5542%207.93452C20.1648%208.54616%2020.5142%209.37085%2020.5288%2010.2349C20.5434%2011.0979%2020.223%2011.9329%2019.6349%2012.5645L17.407%2014.7924C17.2043%2014.9964%2017.0905%2015.2723%2017.0905%2015.5598C17.0905%2015.8474%2017.2043%2016.1232%2017.407%2016.3272ZM14.724%2017.4665L12.4943%2019.7... (truncated)";

const ICON_SELECT_MENU = "data:image/svg+xml,%3csvg%20width='100'%20height='100'%20viewBox='0%200%2032%2032'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20fill-rule='evenodd'%20clip-rule='evenodd'%20d='M25.9898%202.66663C26.8731%202.66663%2027.7202%202.97867%2028.3448%203.53412C28.9694%204.08956%2029.3203%204.84291%2029.3203%205.62843V23.2475L25.0075%2020.649C24.6745%2020.4445%2024.2692%2020.2905%2023.818%2020.2614C23.3525%2020.2314%2022.8532%2020.338%2022.4137%2020.6345C21.9741%2020.931%2021.6882%2021.3539%2021.5416%2021.7968C21.3996%2022.226%2021.3905%2022.6596%2021.4554%2023.045L22.4575%2029.3229H6.00688C5.12358%2029.3229%204.27646%2029.0108%203.65187%2028.4554C3.02728%2027.8999%202.67639%2027.1466%202.67639%2026.3611V5.62843C2.67639%204.84291%203.02728%204.08956%203.65187%203.53412C4.27646%202.97867%205.12358%202.66663%206.00688%202.66663H25.9898ZM6.77494%208.88615C6.77494%209.73802%207.47192%2010.435%208.32379%2010.435H20.7146C21.1254%2010.435%2021.5193%2010.2718%2021.8098%209.98135C22.1002%209.69089%2022.2634%209.29693%2022.2634%208.88615L22.2634%208.31545C22.2634%207.90467%2022.1002%207.51071%2021.8097%207.22025C21.5193%206.92978%2021.1253%206.7666%2020.7145%206.7666H8.32375C7.91297%206.7666%207.51901%206.92978%207.22855%207.22025C6.93808%207.51071%206.7749%207.90467%206.7749%208.31545L6.77494%208.88615ZM8.32379%2016.1652C7.47192%2016.1652%206.77494%2015.4682%206.77494%2014.6163L6.7749%2014.0456C6.7749%2013.6348%206.93808%2013.2409%207.22855%2012.9504C7.51902%2012.6599%207.91297%2012.4968%208.32375%2012.4968H20.7145C21.1253%2012.4968%2021.5193%2012.6599%2021.8097%2012.9504C22.1002%2013.2409%2022.2634%2013.6348%2022.2634%2014.0456L22.2634%2014.6163C22.2634%2015.0271%2022.1002%2015.421%2021.8098%2015.7115C21.5193%2016.002%2021.1254%2016.1652%2020.7146%2016.1652H8.32379ZM6.77494%2020.3466C6.77494%2021.1985%207.47192%2021.8955%208.32379%2021.8955H15.8594C16.2702%2021.8955%2016.6642%2021.7323%2016.9546%2021.4418C17.2451%2021.1513%2017.4083%2020.75... (truncated)";

const ICON_TEXT = "data:image/svg+xml,%3csvg%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M4%206H20M4%2012H20M4%2018H20'%20stroke='%23ABABAB'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3c/svg%3e";
const ICON_CONTAINER = "data:image/svg+xml,%3csvg%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M4%204H20V20H4V4Z'%20stroke='%23ABABAB'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3cpath%20d='M8%208H16M8%2012H16M8%2016H16'%20stroke='%23ABABAB'%20stroke-width='1.5'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3c/svg%3e";
const ICON_MEDIA = "data:image/svg+xml,%3csvg%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3crect%20x='2'%20y='4'%20width='20'%20height='16'%20rx='2'%20stroke='%23ABABAB'%20stroke-width='2'/%3e%3cpath%20d='M7%2012L11%208L13%2010L17%206'%20stroke='%23ABABAB'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3c/svg%3e";
const ICON_FILE = "data:image/svg+xml,%3csvg%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M14%202H6C4.89%202%204%202.89%204%204V20C4%2021.11%204.89%2022%206%2022H18C19.11%2022%2020%2021.11%2020%2020V8L14%202Z'%20stroke='%23ABABAB'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3cpath%20d='M14%202V8H20'%20stroke='%23ABABAB'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3c/svg%3e";
const ICON_DIVIDER = "data:image/svg+xml,%3csvg%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M4%2012H20'%20stroke='%23ABABAB'%20stroke-width='2'%20stroke-linecap='round'/%3e%3c/svg%3e";
const ICON_ROW = "data:image/svg+xml,%3csvg%20width='24'%20height='24'%20viewBox='0%200%2024%2024'%20fill='none'%20xmlns='http://www.w3.org/2000/svg'%3e%3cpath%20d='M4%206H20M4%2012H20M4%2018H20'%20stroke='%23ABABAB'%20stroke-width='2'%20stroke-linecap='round'%20stroke-linejoin='round'/%3e%3c/svg%3e";

const MAIN_ITEMS = [
  { type: "button", label: "Button", desc: "Interactive button", icon: ICON_BUTTON },
  { type: "link", label: "Link Button", desc: "URL button", icon: ICON_LINK_BUTTON },
  { type: "text", label: "Content", desc: "Text display", icon: ICON_TEXT },
  { type: "container", label: "Container", desc: "Nested components", icon: ICON_CONTAINER },
  { type: "media", label: "Media Gallery", desc: "Images & videos", icon: ICON_MEDIA },
  { type: "file", label: "File", desc: "Attachment", icon: ICON_FILE },
  { type: "divider", label: "Separator", desc: "Visual divider", icon: ICON_DIVIDER },
  { type: "row", label: "Row", desc: "Action row (buttons/selects)", icon: ICON_ROW },
];

const SELECT_MENU_OPTIONS = [
  { type: "3", label: "Select Menu", icon: ICON_SELECT_MENU },
  { type: "5", label: "User Select", icon: ICON_SELECT_MENU },
  { type: "6", label: "Role Select", icon: ICON_SELECT_MENU },
  { type: "7", label: "Mentionable Select", icon: ICON_SELECT_MENU },
  { type: "8", label: "Channel Select", icon: ICON_SELECT_MENU },
];

function MenuItem({ item, onClick, disabled }: { item: { type: string; label: string; icon: string; desc?: string }; onClick: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "9px 12px", borderRadius: 6, border: "none",
        backgroundColor: hover ? `${C.burg}25` : "transparent",
        color: hover ? C.burg : C.text, cursor: disabled ? "default" : "pointer",
        fontSize: 12, fontWeight: 500, textAlign: "left", transition: "background 0.1s",
      }}>
      <img src={item.icon} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
    </button>
  );
}

export function AddComponentPopoverV2({ onAdd }: { onAdd: (type: string) => void }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "select">("main");
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const menuW = 240;
      let left = r.left + r.width / 2 - menuW / 2;
      let top = r.bottom + 4;
      if (left + menuW > window.innerWidth) left = window.innerWidth - menuW - 8;
      if (left < 8) left = 8;
      if (top + 320 > window.innerHeight) top = r.top - 320;
      setMenuPos({ top, left });
    }
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false); setView("main");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const close = () => { setOpen(false); setView("main"); };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button ref={btnRef} type="button" onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 32, height: 32, borderRadius: 8, border: "none",
          backgroundColor: "transparent", color: C.textMuted, cursor: "pointer",
          transition: "all 0.12s",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = C.burg; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = C.textMuted; }}
      >
        <CoolIcon icon="Add_Plus_Circle" size={20} />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: "fixed", zIndex: 99999, top: menuPos.top, left: menuPos.left, width: 240,
          borderRadius: 8, border: `1px solid ${C.border}`, backgroundColor: "#18181b",
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)", padding: 6, overflow: "hidden" }}>
          {view === "main" ? (
            <>
              {MAIN_ITEMS.map((item) => (
                <MenuItem key={item.type} item={item}
                  onClick={() => { onAdd(item.type); close(); }}
                />
              ))}
            </>
          ) : (
            <>
              <button type="button" onClick={() => setView("main")}
                style={{ width: "100%", textAlign: "left", padding: "7px 12px", border: "none", background: "transparent",
                  color: C.textMuted, cursor: "pointer", fontSize: 10, fontWeight: 500, borderRadius: 4, marginBottom: 4 }}>
                ← Back
              </button>
              {SELECT_MENU_OPTIONS.map((item) => (
                <MenuItem key={item.type} item={item}
                  onClick={() => { onAdd(item.type); close(); }} />
              ))}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}