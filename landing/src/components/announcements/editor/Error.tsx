import { useState } from "react";
import { InfoBox } from "../InfoBox";

type ErrorParams =
  | { code: string; message?: string; raw?: string }
  | { code?: string; message: string; raw?: string };

export function useError(t?: (key: string) => string) {
  const [text, setText] = useState<string>();
  const [raw, setRaw] = useState<string>();

  return [
    text ? (
      <InfoBox key="0" severity="red" icon="Triangle_Warning" collapsible={!!raw}>
        {text}
        {!!raw && <pre className="whitespace-pre-wrap break-all bg-black/10 dark:bg-white/10 rounded p-1 mt-1 text-[10px]">{raw}</pre>}
      </InfoBox>
    ) : null,
    (params: ErrorParams | undefined) => {
      if (!params) {
        setText(undefined);
        return;
      }
      if (params.code && t) {
        setText(t(params.code));
      } else {
        setText(params.message);
      }
      if (params.raw) setRaw(params.raw);
    },
  ] as const;
}

export type SetErrorFunction = ReturnType<typeof useError>[1];
