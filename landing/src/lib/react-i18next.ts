import { createElement } from "react";
import type { TFunction } from "@/types/i18next";

export { type TFunction };

const translations: Record<string, string> = {
  "content": "Content",
  "accessory": "Accessory",
  "addAccessory": "Add Accessory",
  "addText": "Add Text",
  "delete": "Delete",
  "description": "Description",
  "markSpoiler": "Mark as spoiler",
  "imageUrl": "Image URL",
  "component.2": "Button",
  "component.11": "Thumbnail",
  "linkButton": "Link Button",
};

export function useTranslation(): { t: TFunction } {
  return {
    t: (key: string, options?: Record<string, unknown>) => {
      return translations[key] ?? key;
    },
  };
}

export function Trans({
  t,
  i18nKey,
  values,
}: {
  t?: TFunction;
  i18nKey?: string;
  values?: Record<string, unknown>;
}) {
  const key = i18nKey ?? "";

  if (key.startsWith("timestamp.")) {
    const format = key.replace("timestamp.", "");
    const date = values?.date as Date | undefined;
    const locale = "en-US";
    const timeOpts: Intl.DateTimeFormatOptions = {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    };

    let text: string;
    if (format.startsWith("relative.")) {
      const count = values?.count as number | undefined;
      if (date) {
        const diff = date.getTime() - Date.now();
        const sec = Math.floor(diff / 1000);
        const abs = Math.abs(sec);
        const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
        if (abs < 60) text = rtf.format(sec, "second");
        else if (abs < 3600) text = rtf.format(Math.floor(sec / 60), "minute");
        else if (abs < 86400) text = rtf.format(Math.floor(sec / 3600), "hour");
        else if (abs < 2592000) text = rtf.format(Math.floor(sec / 86400), "day");
        else if (abs < 31536000) text = rtf.format(Math.floor(sec / 2592000), "month");
        else text = rtf.format(Math.floor(sec / 31536000), "year");
      } else {
        text = key;
      }
    } else if (format === "time") {
      text = date?.toLocaleTimeString(locale, timeOpts) ?? "";
    } else if (format === "time_verbose") {
      text = date?.toLocaleTimeString(locale, { ...timeOpts, second: "2-digit" }) ?? "";
    } else if (format === "date") {
      text = date?.toLocaleDateString(locale, { month: "numeric", day: "numeric", year: "numeric" }) ?? "";
    } else if (format === "date_verbose") {
      text = date?.toLocaleDateString(locale, { month: "long", day: "numeric", year: "numeric" }) ?? "";
    } else if (format === "full") {
      text = date
        ? `${date.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })} ${date.toLocaleTimeString(locale, timeOpts)}`
        : "";
    } else if (format === "full_verbose") {
      text = date
        ? `${date.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} ${date.toLocaleTimeString(locale, timeOpts)}`
        : "";
    } else {
      text = key;
    }
    return createElement("span", null, text);
  }

  const labelMap: Record<string, string> = {
    "mention.unknown": "unknown",
    "mention.unknownUser": "Unknown User",
    "mention.deletedRole": "deleted role",
    "mention.guide": "Guide",
    "mention.browse": "Browse Channels",
    "mention.customize": "Browse Channels",
    "mention.linked-roles": "Linked Roles",
  };
  return createElement("span", null, labelMap[key] ?? key);
}
