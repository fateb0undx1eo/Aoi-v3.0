import { ButtonStyle } from "discord-api-types/v10";

export type EditingComponentData = any;
export type ComponentFoundBackupHook = any;

export async function submitComponent<T>(component: T, _setError?: (...args: any[]) => void): Promise<T | undefined> {
  return component;
}

export function getSetEditingComponentProps(props: any) {
  return props;
}

export function IndividualComponentEditor({ component, onClick }: {
  component: any;
  index?: number;
  actionsBar?: any;
  componentFoundBackupsHook?: any;
  row?: any;
  updateRow?: (row: any) => void;
  onClick?: () => void;
}) {
  const isLink = component.style === ButtonStyle.Link;
  const isPremium = component.style === ButtonStyle.Premium;
  const inputClass = "w-full rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-600 outline-none";
  const inputBg = "#1A1A1A";

  return (
    <div className="rounded border border-zinc-800 bg-[#111] p-2 mt-1 cursor-pointer" onClick={onClick}>
      <div className="flex flex-col gap-1.5">
        {!isPremium && (
          <input type="text" value={component.label ?? ""} placeholder="Label"
            className={inputClass} style={{ backgroundColor: inputBg }}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { component.label = e.target.value || undefined; }}
          />
        )}
        {isLink ? (
          <input type="text" value={component.url ?? ""} placeholder="URL"
            className={inputClass} style={{ backgroundColor: inputBg }}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { component.url = e.target.value; }}
          />
        ) : !isPremium ? (
          <input type="text" value={component.custom_id ?? ""} placeholder="Custom ID"
            className={inputClass} style={{ backgroundColor: inputBg }}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { component.custom_id = e.target.value; }}
          />
        ) : null}
        {!isPremium && (
          <input type="text" value={component.emoji?.name ?? ""} placeholder="Emoji"
            className={inputClass} style={{ backgroundColor: inputBg }}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => { component.emoji = e.target.value ? { name: e.target.value } : undefined; }}
          />
        )}
        <select value={component.style}
          className="w-full rounded border border-zinc-800 bg-[#1A1A1A] text-zinc-400 text-[10px] px-1.5 py-1 outline-none"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { component.style = Number(e.target.value); }}
        >
          {[1, 2, 3, 4, 5, 6].map((s) => (
            <option key={s} value={s}>{["Primary", "Secondary", "Success", "Danger", "Link", "Premium"][s - 1]}</option>
          ))}
        </select>
        {!isLink && !isPremium && (
          <label className="flex items-center gap-1 text-[10px] text-zinc-500 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={component.disabled ?? false}
              onChange={(e) => { component.disabled = e.target.checked || undefined; }}
              className="h-3 w-3 rounded border-zinc-700 bg-zinc-800" />
            Disabled
          </label>
        )}
      </div>
    </div>
  );
}
