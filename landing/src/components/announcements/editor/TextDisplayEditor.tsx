import { ButtonStyle, ComponentType } from "discord-api-types/v10";
import { useTranslation } from "@/lib/react-i18next";
import type { APIContainerComponent, APIV2TextDisplay, QueryData, SectionAccessory, APIButtonComponent } from "../types";
import { MAX_TOTAL_COMPONENTS_CHARACTERS } from "../constants";
import { ButtonSelect } from "./ButtonSelect";
import { useError } from "./Error";
import { TextArea } from "./TextArea";
import { submitComponent } from "./ComponentEditor";
import { TopLevelComponentEditorContainer } from "./TopLevelComponentEditor";

export const TextDisplayEditor: React.FC<{
  message: QueryData["messages"][number];
  component: APIV2TextDisplay;
  parent: APIContainerComponent | undefined;
  index: number;
  data: QueryData;
  setData: React.Dispatch<QueryData>;
  drag?: unknown;
  open?: boolean;
}> = ({
  message,
  component,
  parent,
  index: i,
  data,
  setData,
  drag,
  open,
}) => {
  const { t } = useTranslation();
  const [error, setError] = useError(t);

  return (
    <TopLevelComponentEditorContainer
      t={t}
      message={message}
      component={component}
      parent={parent}
      index={i}
      data={data}
      setData={setData}
      drag={drag}
      open={open}
    >
      {error}
      <div className="space-y-2">
        <div>
          <TextArea
            label={t("content")}
            className="w-full"
            maxLength={MAX_TOTAL_COMPONENTS_CHARACTERS}
            required
            value={component.content}
            onChange={({ currentTarget }) => {
              component.content = currentTarget.value;
              setData({ ...data });
            }}
          />
        </div>
        <div>
          <p className="text-sm font-medium cursor-default">{t("accessory")}</p>
          <ButtonSelect<"button" | "linkButton" | "thumbnail">
            options={[
              { label: t("component.2"), icon: "Mouse", value: "button" },
              {
                label: t("linkButton"),
                icon: "External_Link",
                value: "linkButton",
              },
              {
                label: t("component.11"),
                icon: "Image_01",
                value: "thumbnail",
              },
            ]}
            onValueChange={async (value) => {
              const parentChildren =
                parent?.components ?? message.data.components;
              if (!parentChildren) {
                console.log(
                  "Could not resolve sibling container to splice into",
                );
                return;
              }
              let accessory: SectionAccessory | undefined;
              switch (value) {
                case "button":
                  accessory = {
                    type: ComponentType.Button,
                    style: ButtonStyle.Primary,
                    custom_id: "",
                  };
                  break;
                case "linkButton":
                  accessory = {
                    type: ComponentType.Button,
                    style: ButtonStyle.Link,
                    url: "https://discohook.app",
                  };
                  break;
                case "thumbnail":
                  accessory = {
                    type: ComponentType.Thumbnail,
                    media: { url: "" },
                  };
                  break;
                default:
                  break;
              }

              const setAccessory = (
                accessory: SectionAccessory & { _state?: string },
              ) => {
                parentChildren.splice(i, 1, {
                  type: ComponentType.Section,
                  components: [component],
                  accessory,
                });
                setData({ ...data });
              };

              if (accessory) {
                if (accessory.type === ComponentType.Button) {
                  setAccessory({ ...accessory, _state: "submitting" });

                  const accessoryComponent = (await submitComponent(
                    accessory,
                    setError,
                  )) as APIButtonComponent | undefined;
                  if (accessoryComponent) {
                    setAccessory(accessoryComponent);
                  }
                } else {
                  setAccessory(accessory);
                }
              }
            }}
          >
            {t("addAccessory")}
          </ButtonSelect>
        </div>
      </div>
    </TopLevelComponentEditorContainer>
  );
};
