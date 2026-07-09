import { Select } from "@base-ui-components/react/select";
import type { ButtonStyle } from "discord-api-types/v10";
import { twJoin, twMerge } from "tailwind-merge";
import { Button } from "../Button";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { selectStyles } from "../StringSelect";

export function ButtonSelect<T>(
  props: React.PropsWithChildren<{
    name?: string;
    options: {
      label: React.ReactNode;
      icon?: string;
      value: T;
      disabled?: boolean;
    }[];
    value?: T;
    onValueChange?: (value: T | null) => void;
    required?: boolean;
    disabled?: boolean;
    readOnly?: boolean;
    className?: string;
    discordstyle?: ButtonStyle;
    icon?: string | null;
    iconClassName?: string;
  }>,
) {
  return (
    <Select.Root
      items={props.options}
      value={props.value}
      onValueChange={props.onValueChange}
      name={props.name}
      required={props.required}
      disabled={props.disabled}
      readOnly={props.readOnly}
    >
      <Select.Trigger
        className="size-fit"
        disabled={props.disabled}
        tabIndex={-1}
      >
        <Button
          className={props.className}
          disabled={props.disabled}
          discordstyle={props.discordstyle}
        >
          {props.children}
          {props.icon !== null ? (
            <CoolIcon
              icon={props.icon ?? "Chevron_Down"}
              className={twMerge(
                "my-auto ms-1.5 transition-transform",
                props.iconClassName,
              )}
            />
          ) : null}
        </Button>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className={selectStyles.positioner}
          align="start"
          alignOffset={2}
        >
          <Select.ScrollUpArrow />
          <Select.Popup>
            <Select.Arrow />
            {props.options?.map((option) => (
              <Select.Item
                key={`button-string-select-option-${option.value}`}
                value={option.value}
                className={selectStyles.item}
                disabled={option.disabled}
              >
                <Select.ItemText
                  className={twJoin(selectStyles.itemText, "flex items-center")}
                >
                  {option.icon ? (
                    <CoolIcon icon={option.icon} className="text-lg me-1.5" />
                  ) : null}
                  {option.label}
                </Select.ItemText>
                {props.value !== undefined ? (
                  <Select.ItemIndicator className={selectStyles.itemIndicator}>
                    <CoolIcon icon="Check" />
                  </Select.ItemIndicator>
                ) : null}
              </Select.Item>
            ))}
          </Select.Popup>
          <Select.ScrollDownArrow />
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
