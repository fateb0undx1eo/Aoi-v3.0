import { useTranslation } from "@/lib/react-i18next";
import type { APIContainerComponent, APIV2Separator, QueryData } from "../types";
import { Checkbox } from "../Checkbox";
import { useError } from "./Error";
import { OptionSlider } from "./OptionSlider";
import { TopLevelComponentEditorContainer } from "./TopLevelComponentEditor";

export const SeparatorEditor: React.FC<{
  message: QueryData["messages"][number];
  component: APIV2Separator;
  parent: APIContainerComponent | undefined;
  index: number;
  data: QueryData;
  setData: React.Dispatch<QueryData>;
  drag?: unknown;
  open?: boolean;
}> = ({ message, component, parent, index: i, data, setData, drag, open }) => {
  const { t } = useTranslation();
  const [error] = useError(t);

  return (
    <TopLevelComponentEditorContainer
      t={t}
      message={message}
      component={component as any}
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
          <p className="text-sm font-medium cursor-default">
            {t("separatorSize")}
          </p>
          <OptionSlider
            value={component.spacing ?? 1}
            options={[
              { id: 1, label: t("small") },
              { id: 2, label: t("large") },
            ]}
            onSelect={(value) => {
              component.spacing = value;
              setData({ ...data });
            }}
          />
        </div>
        <Checkbox
          label={t("separatorLine")}
          checked={component.divider ?? true}
          onCheckedChange={(checked) => {
            component.divider = checked;
            setData({ ...data });
          }}
        />
      </div>
    </TopLevelComponentEditorContainer>
  );
};
