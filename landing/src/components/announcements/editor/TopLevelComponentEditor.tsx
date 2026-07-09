import { CoolIcon } from "@/components/icons/CoolIcon";
import * as Collapsible from "@radix-ui/react-collapsible";
import { twJoin } from "tailwind-merge";
import type { QueryData, QueryDataMessage, APIContainerComponent, APIV2TextDisplay } from "../types";

interface TopLevelComponentEditorContainerProps {
  message: QueryDataMessage;
  component: APIV2TextDisplay;
  parent: APIContainerComponent | undefined;
  index: number;
  data: QueryData;
  setData: React.Dispatch<QueryData>;
  drag?: unknown;
  open?: boolean;
  t?: (key: string) => string;
  children: React.ReactNode;
}

export function TopLevelComponentEditorContainer({
  message,
  component,
  parent,
  index: i,
  data,
  setData,
  drag,
  open,
  t,
  children,
}: TopLevelComponentEditorContainerProps) {
  const parentChildren = parent?.components ?? message.data.components;

  return (
    <Collapsible.Root
      defaultOpen={open !== false}
      className={twJoin(
        "group/top-2 relative overflow-hidden rounded-lg border border-gray-300 bg-gray-100 py-2 pe-2 ps-3 shadow transition-[border-color,border-width] dark:border-gray-700 dark:bg-gray-800",
      )}
    >
      <div
        className={twJoin(
          "flex items-center text-gray-600 dark:text-gray-400 transition-all pe-2",
          "-m-2 rounded-lg bg-gray-100 dark:bg-gray-800",
          "group-data-[state=open]/top-2:mb-0",
          "group-data-[state=open]/top-2:rounded-b-none",
          "group-data-[state=open]/top-2:border-b border-gray-300 dark:border-gray-700",
        )}
      >
        <Collapsible.Trigger
          className={twJoin(
            "truncate flex items-center text-lg grow font-semibold cursor-default select-none p-2 ps-4",
            "group/trigger-2",
          )}
        >
          <CoolIcon icon="Chevron_Right"
            className={twJoin(
              "group-data-[state=open]/trigger-2:rotate-90",
              "me-2 transition-transform shrink-0",
            )}
            size={20}
          />
          <p className="truncate">
            Text Display
            {component.content ? (
              <span className="text-gray-500 dark:text-gray-500 font-normal">
                {" "}&mdash;{" "}
                {component.content.length > 50
                  ? component.content.slice(0, 50) + "..."
                  : component.content}
              </span>
            ) : null}
          </p>
        </Collapsible.Trigger>
        <div className="ms-auto text-xl space-x-2.5 rtl:space-x-reverse shrink-0 flex items-center">
          {drag ? <CoolIcon icon="Drag_Vertical" className="shrink-0 text-gray-400" size={16} /> : null}
          <button type="button" onClick={() => {
            if (parentChildren) {
              parentChildren.splice(i, 1);
              setData({ ...data });
            }
          }}
            className="text-zinc-600 hover:text-red-400 flex items-center p-0 border-none bg-none cursor-pointer"
            aria-label="Remove"
          >
            <CoolIcon icon="Close_MD" size={18} />
          </button>
        </div>
      </div>
      <Collapsible.Content className="flex flex-col justify-end overflow-hidden transition-all space-y-0 data-[state=closed]:h-0 data-[state=open]:h-auto">
        {children}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
