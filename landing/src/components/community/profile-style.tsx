import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import type { ProfileStyleConfig } from "./types";
import { PROFILE_STYLE_FONTS, PROFILE_STYLE_EFFECTS, decimalToHexColor, parseHexColor } from "./utils";

type Props = {
  form: ProfileStyleConfig;
  onChange: (updates: Partial<ProfileStyleConfig>) => void;
  useGradient: boolean;
  onUseGradientChange: (value: boolean) => void;
};

export function ProfileStyleSection({ form, onChange, useGradient, onUseGradientChange }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="mb-3 text-sm font-medium text-zinc-200">Name Style & Colors</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-zinc-200">Font</Label>
          <Select
            value={String(form.font_id)}
            onValueChange={(value) => onChange({ font_id: Number(value) })}
          >
            <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
              <SelectValue placeholder="Select font" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-black text-zinc-100">
              {PROFILE_STYLE_FONTS.map((font) => (
                <SelectItem key={font.id} value={String(font.id)} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-zinc-200">Effect</Label>
          <Select
            value={String(form.effect_id)}
            onValueChange={(value) => onChange({ effect_id: Number(value) })}
          >
            <SelectTrigger className="border-zinc-800 bg-black text-zinc-100">
              <SelectValue placeholder="Select effect" />
            </SelectTrigger>
            <SelectContent className="border-zinc-800 bg-black text-zinc-100">
              {PROFILE_STYLE_EFFECTS.map((effect) => (
                <SelectItem key={effect.id} value={String(effect.id)} className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                  {effect.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="bot-profile-color1" className="text-zinc-200">Primary Color</Label>
        <Input
          id="bot-profile-color1"
          type="color"
          value={form.colors[0] !== undefined ? decimalToHexColor(form.colors[0]) : "#5865F2"}
          className="h-11 w-full border-zinc-800 bg-zinc-950 text-zinc-100"
          onChange={(event) => {
            const parsed = parseHexColor(event.target.value);
            onChange({
              colors: parsed === null ? form.colors : [parsed, ...form.colors.slice(1, 2)],
            });
          }}
        />
      </div>

      {useGradient && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="bot-profile-color2" className="text-zinc-200">Secondary Color</Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="gradient-toggle" className="text-[11px] text-zinc-400">Gradient</Label>
              <Switch
                id="gradient-toggle"
                checked={useGradient}
                onCheckedChange={onUseGradientChange}
              />
            </div>
          </div>
          <Input
            id="bot-profile-color2"
            type="color"
            value={form.colors[1] !== undefined ? decimalToHexColor(form.colors[1]) : "#00FFFF"}
            className="h-11 w-full border-zinc-800 bg-zinc-950 text-zinc-100"
            onChange={(event) => {
              const parsed = parseHexColor(event.target.value);
              if (parsed === null) return;
              onChange({
                colors: form.colors[0] === undefined ? [parsed] : [form.colors[0], parsed],
              });
            }}
          />
        </div>
      )}

      {!useGradient && (
        <div className="mt-3 flex items-center justify-end gap-2">
          <Label htmlFor="gradient-toggle" className="text-[11px] text-zinc-400">Gradient</Label>
          <Switch
            id="gradient-toggle"
            checked={useGradient}
            onCheckedChange={onUseGradientChange}
          />
        </div>
      )}
    </div>
  );
}
