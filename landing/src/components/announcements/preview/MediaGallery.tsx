import mime from "mime";
import type { SetImageModalData, DraftFile, APIV2MediaGallery } from "../types";
import { getImageUri, resolveAttachmentUri } from "../utils/files";
import Gallery from "./Gallery";

export const PreviewMediaGallery: React.FC<{
  component: APIV2MediaGallery;
  files?: DraftFile[];
  setImageModalData?: SetImageModalData;
  cdn?: string;
}> = ({ component: gallery, files, setImageModalData, cdn }) => {
  return (
    <div>
      <Gallery
        cdn={cdn}
        setImageModalData={setImageModalData}
        attachments={gallery.items.map((item, i) => {
          let url = item.media.url;
          let file: DraftFile | undefined;

          if (url.startsWith("attachment://") && files) {
            const fileUrl = getImageUri(url, files);
            if (fileUrl) url = fileUrl;
            file = resolveAttachmentUri(url, files);
          }

          let contentType = file?.file?.type ?? null;
          if (!contentType) {
            try {
              const { pathname } = new URL(url);
              contentType = mime.getType(pathname);
            } catch {}
          }
          return {
            id: String(i),
            url,
            content_type: contentType ?? "image/png",
            filename: file?.file?.name ?? "unknown",
            size: file?.file?.size ?? 0,
            proxy_url: "#",
          };
        })}
      />
    </div>
  );
};
