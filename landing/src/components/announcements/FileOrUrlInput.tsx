import { ButtonStyle } from "discord-api-types/v10";
import { twJoin } from "tailwind-merge";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { Button } from "./Button";
import { PasteFileButton } from "./PasteFileButton";
import { TextInput } from "./TextInput";
import type { DraftFile } from "./types";
import {
  ATTACHMENT_URI_EXTENSIONS,
  isGifVideoUrl,
  resolveAttachmentUri,
  transformFileName,
} from "./utils/files";
import { randomId } from "./utils/message";

export const FileOrUrlInput: React.FC<{
  t: (key: string) => string;
  key_?: string;
  value: string | undefined;
  onChange: (url: string) => void;
  files?: DraftFile[];
  setFiles?: React.Dispatch<React.SetStateAction<DraftFile[]>>;
  fileClearable?: boolean;
  className?: string;
  labelKey?: string;
  required?: boolean;
  cdn?: string;
  gifPrompt?: boolean;
  allowedExtensions?: readonly string[] | "*";
}> = ({
  t,
  key_: key,
  value,
  onChange,
  files = [],
  setFiles,
  fileClearable,
  className,
  labelKey,
  required,
  cdn,
  gifPrompt,
  allowedExtensions = ATTACHMENT_URI_EXTENSIONS,
}) => {
  const id = randomId();
  const file = value?.startsWith("attachment://")
    ? resolveAttachmentUri(value, files)
    : undefined;

  const gifVideoUrl = gifPrompt && value ? isGifVideoUrl(value, cdn) : null;

  return file ? (
    <div>
      <p className="font-medium text-sm cursor-default">
        <span>{t(labelKey ?? "attachment")}</span>
        {file.file?.type.startsWith("image/") ? (
          <CoolIcon icon="Image_01" className="ltr:ml-1 rtl:mr-1" />
        ) : file.file?.type.startsWith("video/") ? (
          <CoolIcon icon="Monitor_Play" className="ltr:ml-1 rtl:mr-1" />
        ) : null}
      </p>
      <div className="flex gap-2 w-full">
        <div
          className={twJoin(
            "my-auto rounded-lg truncate",
            "border h-9 px-[14px] bg-white dark:bg-[#1A1A1A] border-gray-300 dark:border-zinc-700 flex w-full",
            className,
          )}
        >
          <p className="my-auto truncate text-sm text-gray-900 dark:text-zinc-200">{file.file?.name ?? file.name ?? value}</p>
        </div>
        {fileClearable !== false ? (
          <button
            type="button"
            className={twJoin(
              "my-auto rounded-lg flex shrink-0 items-center justify-center",
              "border h-9 w-9 bg-white dark:bg-[#1A1A1A] border-gray-300 dark:border-zinc-700 text-zinc-500 hover:text-red-400 transition cursor-pointer",
            )}
            onClick={() => onChange("")}
          >
            <CoolIcon icon="Close_MD" />
          </button>
        ) : null}
      </div>
    </div>
  ) : (
    <div className="flex gap-2 w-full">
      <div
        className={twJoin(
          "w-full transition-[max-width]",
          value ? "max-w-full" : "max-w-[50%]",
        )}
      >
        <TextInput
          key={key}
          label={t(labelKey ?? "url")}
          required={required}
          type="url"
          className="w-full"
          value={value ?? ""}
          onChange={({ currentTarget }) => onChange(currentTarget.value)}
        />
        {gifVideoUrl ? (
          <p className="mt-1 text-xs text-yellow-500 dark:text-yellow-400 flex items-center gap-1">
            <CoolIcon icon="Bulb" className="shrink-0" />
            {t("gifConvertSuggestion")}
          </p>
        ) : null}
      </div>
      <div
        className={twJoin(
          "transition-all min-w-[6.75rem]",
          value ? "max-w-[6.75rem]" : "max-w-[50%] w-full",
        )}
      >
        <p className="text-sm font-medium cursor-default">{t("file")}</p>
        <div className="flex flex-row-reverse gap-1">
          <PasteFileButton
            t={t as any}
            disabled={files.length >= 10}
            className="peer h-9 min-w-0 grow max-w-full px-4"
            getChildren={(state) => {
              if (state === "active_mac") return t("pasteCmd");
              if (state === "active") return t("pasteCtrl");
              return value ? (
                <CoolIcon icon="Archive" />
              ) : (
                <>
                  <CoolIcon icon="Archive" className="lg:hidden" />
                  <span className="hidden lg:block">{t("pasteFile")}</span>
                </>
              );
            }}
            onChange={async (list) => {
              if (files.length >= 10) return;
              const file = list[0];
              if (!file) return;
              const newFiles = [...files];
              newFiles.push({
                id: randomId(),
                file,
                url: URL.createObjectURL(file),
                name: file.name,
                size: file.size,
                spoiler: false,
              });
              setFiles?.(newFiles);
              onChange(`attachment://${transformFileName(file.name)}`);
            }}
          />
          <input
            id={`files-${id}`}
            type="file"
            hidden
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              if (!file) return;
              const newFiles = [...files];
              newFiles.push({
                id: randomId(),
                file,
                url: URL.createObjectURL(file),
                name: file.name,
                size: file.size,
                spoiler: false,
              });
              setFiles?.(newFiles);
              onChange(`attachment://${transformFileName(file.name)}`);
              e.currentTarget.value = "";
            }}
            accept={
              allowedExtensions !== "*"
                ? allowedExtensions.join(",")
                : undefined
            }
          />
          <Button
            className="h-9 min-w-0 px-4 grow max-w-full transition-all"
            title={t("addFile")}
            onClick={() => {
              const input = document.querySelector<HTMLInputElement>(
                `input#files-${id}`,
              );
              input?.click();
            }}
            disabled={files.length >= 10}
            discordstyle={ButtonStyle.Primary}
          >
            <CoolIcon icon="File_Upload" className={value ? "" : "lg:hidden"} />
            {value ? null : (
              <span className="hidden lg:block">{t("addFile")}</span>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
