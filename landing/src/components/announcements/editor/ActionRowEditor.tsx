import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import { useTranslation } from "react-i18next";
import { twJoin } from "tailwind-merge";
import type {
  APIActionRowComponent,
  APIContainerComponent,
  APIComponentInActionRow,
  QueryData,
} from "../types";
import { ButtonSelect } from "./ButtonSelect";
import { useError } from "./Error";
import { CoolIcon } from "@/components/icons/CoolIcon";
import { TopLevelComponentEditorContainer } from "./TopLevelComponentEditor";
import { submitComponent } from "./ComponentEditor";

const MAX_ACTION_ROW_WIDTH = 5;

function getComponentText(component: APIComponentInActionRow): string {
  switch (component.type) {
    case ComponentType.Button:
      return component.label || component.emoji?.name || component.emoji?.id || "";
    case ComponentType.StringSelect:
      return component.placeholder || "";
    case ComponentType.UserSelect:
    case ComponentType.RoleSelect:
    case ComponentType.MentionableSelect:
    case ComponentType.ChannelSelect:
      return component.placeholder || "";
    default:
      return "";
  }
}

function getRowWidth(components: APIComponentInActionRow[]): number {
  return components.reduce((width, c) => {
    if (c.type === ComponentType.Button) return width + 1;
    return width + MAX_ACTION_ROW_WIDTH;
  }, 0);
}

export const ActionRowEditor: React.FC<{
  message: QueryData["messages"][number];
  component: APIActionRowComponent;
  parent: APIContainerComponent | undefined;
  index: number;
  data: QueryData;
  setData: React.Dispatch<QueryData>;
  setEditingComponent?: React.Dispatch<
    React.SetStateAction<any>
  >;
  drag?: unknown;
  open?: boolean;
}> = ({
  message,
  component: row,
  parent,
  index: i,
  data,
  setData,
  setEditingComponent,
  drag,
  open,
}) => {
  const { t } = useTranslation();
  const [error, setError] = useError(t);
  const mid = message._id ?? i;

  return (
    <TopLevelComponentEditorContainer
      t={t}
      message={message}
      component={row as any}
      parent={parent}
      index={i}
      data={data}
      setData={setData}
      drag={drag}
      open={open}
    >
      {error}
      <div className="space-y-1">
        {row.components.map((component, ci) => {
          const previewText = getComponentText(component);
          const anySubmitting = row.components.some(
            (c) => "_state" in c && c._state === "submitting",
          );

          return (
            <div
              key={`edit-message-${mid}-component-${ci}`}
              className="flex text-base text-gray-600 dark:text-gray-400 rounded-lg bg-blurple/10 hover:bg-blurple/15 border border-blurple/30 shadow hover:shadow-lg transition font-semibold select-none"
            >
              <button
                type="button"
                className="flex p-2 h-full w-full my-auto truncate disabled:animate-pulse"
                onClick={() => {
                  setEditingComponent?.({
                    component,
                    row,
                    componentIndex: ci,
                    data,
                    setData,
                    setEditingComponent,
                  });
                }}
                disabled={"_state" in component && component._state === "submitting"}
              >
                <div className="me-2 my-auto size-6 shrink-0">
                  {component.type === ComponentType.Button ? (
                    <div
                      className={twJoin(
                        "rounded text-gray-50",
                        component.style === ButtonStyle.Link
                          ? "p-[5px_5px_4px_4px]"
                          : "w-full h-full",
                        {
                          [ButtonStyle.Primary]: "bg-blurple",
                          [ButtonStyle.Secondary]: "bg-[#6d6f78] dark:bg-[#4e5058]",
                          [ButtonStyle.Success]: "bg-[#248046] dark:bg-[#248046]",
                          [ButtonStyle.Danger]: "bg-[#da373c]",
                          [ButtonStyle.Link]: "bg-[#6d6f78] dark:bg-[#4e5058]",
                          [ButtonStyle.Premium]: "bg-blurple",
                        }[component.style],
                      )}
                    >
                      {component.style === ButtonStyle.Link && (
                        <CoolIcon icon="External_Link" className="block" />
                      )}
                    </div>
                  ) : (
                    <div className="rounded bg-[#6d6f78] dark:bg-[#4e5058] p-[5px_5px_4px_4px]">
                      <CoolIcon
                        icon={
                          {
                            [ComponentType.StringSelect]: "Chevron_Down",
                            [ComponentType.UserSelect]: "Users",
                            [ComponentType.RoleSelect]: "Tag",
                            [ComponentType.MentionableSelect]: "Mention",
                            [ComponentType.ChannelSelect]: "Chat",
                          }[component.type]
                        }
                        className="block"
                      />
                    </div>
                  )}
                </div>
                <p className="truncate my-auto">
                  {previewText ||
                    `${t(`component.${component.type}`)} ${
                      component.type === ComponentType.Button ? ci + 1 : ""
                    }`}
                </p>
              </button>
              <div className="ms-auto text-lg space-x-2.5 rtl:space-x-reverse my-auto shrink-0 p-2 pl-0">
                <button
                  type="button"
                  className={ci === 0 ? "hidden" : ""}
                  disabled={anySubmitting}
                  onClick={() => {
                    row.components.splice(ci, 1);
                    row.components.splice(ci - 1, 0, component);
                    setData({ ...data });
                  }}
                >
                  <CoolIcon icon="Chevron_Up" />
                </button>
                <button
                  type="button"
                  className={ci === row.components.length - 1 ? "hidden" : ""}
                  disabled={anySubmitting}
                  onClick={() => {
                    row.components.splice(ci, 1);
                    row.components.splice(ci + 1, 0, component);
                    setData({ ...data });
                  }}
                >
                  <CoolIcon icon="Chevron_Down" />
                </button>
                <button
                  type="button"
                  className={getRowWidth(row.components) >= MAX_ACTION_ROW_WIDTH ? "hidden" : ""}
                  disabled={anySubmitting}
                  onClick={async () => {
                    const { custom_id: _, ...withoutId } = component as any;
                    const copied = await submitComponent(
                      { custom_id: "", ...withoutId } as any,
                      setError,
                    );
                    if (copied) {
                      row.components.splice(ci + 1, 0, copied as any);
                      setData({ ...data });
                    }
                  }}
                >
                  <CoolIcon icon="Copy" />
                </button>
                <button
                  type="button"
                  disabled={anySubmitting}
                  onClick={() => {
                    row.components.splice(ci, 1);
                    setData({ ...data });
                  }}
                >
                  <CoolIcon icon="Trash_Full" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <ButtonSelect<ComponentType | "linkButton">
        name="component-type"
        options={[
          {
            label: t("component.2"),
            value: ComponentType.Button,
            disabled: getRowWidth(row.components) >= MAX_ACTION_ROW_WIDTH,
          },
          {
            label: t("linkButton"),
            value: "linkButton",
            disabled: getRowWidth(row.components) >= MAX_ACTION_ROW_WIDTH,
          },
          {
            label: t("component.3"),
            value: ComponentType.StringSelect,
            disabled: getRowWidth(row.components) > 0,
          },
          {
            label: t("component.5"),
            value: ComponentType.UserSelect,
            disabled: getRowWidth(row.components) > 0,
          },
          {
            label: t("component.6"),
            value: ComponentType.RoleSelect,
            disabled: getRowWidth(row.components) > 0,
          },
          {
            label: t("component.7"),
            value: ComponentType.MentionableSelect,
            disabled: getRowWidth(row.components) > 0,
          },
          {
            label: t("component.8"),
            value: ComponentType.ChannelSelect,
            disabled: getRowWidth(row.components) > 0,
          },
        ]}
        disabled={getRowWidth(row.components) >= MAX_ACTION_ROW_WIDTH}
        onValueChange={async (type) => {
          if (type == null) return;
          let submitData: any;
          switch (type) {
            case "linkButton":
              submitData = {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                url: "https://discohook.app",
              };
              break;
            case ComponentType.Button:
              submitData = {
                type,
                style: ButtonStyle.Primary,
                custom_id: "",
              };
              break;
            case ComponentType.StringSelect:
              submitData = {
                type,
                custom_id: "",
                options: [],
              };
              break;
            case ComponentType.UserSelect:
            case ComponentType.RoleSelect:
            case ComponentType.MentionableSelect:
            case ComponentType.ChannelSelect:
              submitData = {
                type,
                custom_id: "",
              };
              break;
          }
          if (submitData) {
            const idx = row.components.push({ ...submitData, _state: "submitting" }) - 1;
            setData({ ...data });

            const component = await submitComponent(submitData as any, setError);
            if (component) {
              row.components.splice(idx, 1, component as any);
            }
            setData({ ...data });
          }
        }}
      >
        {t("addComponent")}
      </ButtonSelect>
    </TopLevelComponentEditorContainer>
  );
};
