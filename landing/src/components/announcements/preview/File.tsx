import type { APIFileComponent } from "discord-api-types/v10";
import type { DraftFile } from "../types";
import { resolveAttachmentUri } from "../utils/files";
import FileAttachment from "./FileAttachment";

export const PreviewFile: React.FC<{
  component: APIFileComponent;
  files?: DraftFile[];
}> = ({ component, files }) => {
  const file = resolveAttachmentUri(component.file.url, files);
  return (
    <div>
      <FileAttachment
        attachment={{
          id: "0",
          url: file?.url ?? component.file.url,
          proxy_url: "#",
          filename: file?.name ?? "unknown",
          size: file?.size ?? 0,
        }}
      />
    </div>
  );
};
