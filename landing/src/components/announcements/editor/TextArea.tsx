import { useRef, useState, type ReactNode } from "react";
import { twJoin } from "tailwind-merge";
import { CoolIcon } from "@/components/icons/CoolIcon";

export function TextArea(
  props: React.DetailedHTMLProps<
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    HTMLTextAreaElement
  > & {
    label: ReactNode;
    description?: ReactNode;
    delayOnInput?: number;
    errors?: ReactNode[];
    freeLength?: boolean;
  },
) {
  const {
    label,
    onInput,
    delayOnInput,
    freeLength,
    ...newProps
  } = props;
  const ref = useRef<HTMLTextAreaElement>(null);
  const length = ref.current ? ref.current.value.length : 0;

  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout>>();

  if (freeLength) {
    newProps.maxLength = undefined;
  }

  return (
    <label className="block">
      <p className="text-sm font-medium">
        {label}
        {newProps.required && (
          <span className="align-baseline ms-2 text-xs italic text-rose-400">*</span>
        )}
        {props.maxLength && (
          <span
            className={twJoin(
              "ms-2 italic text-xs align-baseline",
              length >= props.maxLength
                ? "text-red-300"
                : length / (props.maxLength || 1) >= 0.9
                  ? "text-yellow-300"
                  : "text-gray-400 dark:text-zinc-500",
            )}
          >
            {length}/{props.maxLength}
          </span>
        )}
      </p>
      {props.description && <p className="text-sm">{props.description}</p>}
      <textarea
        {...newProps}
        ref={ref}
        onInput={(e) => {
          const event = { ...e };

          if (timeoutId) {
            clearTimeout(timeoutId);
            setTimeoutId(undefined);
          }

          if (onInput && delayOnInput !== undefined) {
            setTimeoutId(
              setTimeout(() => {
                onInput(event);
                setTimeoutId(undefined);
              }, delayOnInput),
            );
          } else if (onInput) {
            return onInput(event);
          }
        }}
        className={twJoin(
          "w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1A1A1A] px-3 py-2 text-sm text-gray-900 dark:text-zinc-200 placeholder-zinc-500 outline-none resize-y leading-relaxed",
          "invalid:border-rose-400 dark:invalid:border-rose-400 disabled:text-gray-600 disabled:cursor-not-allowed transition",
          props.className,
        )}
        rows={(props as any).rows ?? 4}
      />
      {props.errors
        ?.filter((e) => e !== undefined)
        .map((error, i) => (
          <p
            key={`${props.id ?? label}-error-${i}`}
            className="text-rose-500 dark:text-rose-300 font-medium mt-1 text-sm"
          >
            <CoolIcon icon="Circle_Warning" className="me-1.5" />
            {error}
          </p>
        ))}
    </label>
  );
}
