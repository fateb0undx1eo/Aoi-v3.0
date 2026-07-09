import { useRef, useState, type ReactNode } from "react";
import { twJoin } from "tailwind-merge";
import { CoolIcon } from "@/components/icons/CoolIcon";

export const textInputStyles = {
  label: "text-sm font-medium",
  input:
    "rounded-lg border min-h-[36px] max-h-9 py-0 px-3.5 bg-white dark:bg-[#1A1A1A] border-gray-300 dark:border-zinc-700 placeholder-zinc-500 focus:outline-none focus:border-blurple dark:focus:border-blue-500 invalid:border-rose-400 dark:invalid:border-rose-400 disabled:text-gray-600 disabled:cursor-not-allowed transition w-full text-sm text-gray-900 dark:text-zinc-200",
};

export function TextInput(
  props: React.DetailedHTMLProps<
    React.InputHTMLAttributes<HTMLInputElement>,
    HTMLInputElement
  > & {
    label?: ReactNode;
    labelClassName?: string;
    description?: ReactNode;
    delayOnInput?: number;
    freeLength?: boolean;
    errors?: ReactNode[];
  },
) {
  const {
    label,
    labelClassName,
    onInput,
    delayOnInput,
    freeLength,
    ...newProps
  } = props;
  const ref = useRef<HTMLInputElement>(null);
  const length = ref.current ? ref.current.value.length : 0;

  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout>>();

  if (freeLength) {
    newProps.maxLength = undefined;
  }

  return (
    <label className={twJoin("block", labelClassName)}>
      {label || newProps.required || props.maxLength ? (
        <p className={textInputStyles.label}>
          {label}
          {newProps.required ? (
            <span className="align-baseline ms-2 text-xs italic text-rose-400">*</span>
          ) : null}
          {props.maxLength ? (
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
          ) : null}
        </p>
      ) : null}
      {props.description ? (
        <p className="text-sm mb-0.5">{props.description}</p>
      ) : null}
      <input
        type="text"
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
        className={twJoin(textInputStyles.input, props.className)}
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
