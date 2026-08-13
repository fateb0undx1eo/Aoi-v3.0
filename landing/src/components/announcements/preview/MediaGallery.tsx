import mime from "mime";
import type { SetImageModalData, DraftFile, APIV2MediaGallery } from "../types";
import { getImageUri, resolveAttachmentUri } from "../utils/files";
import Gallery from "./Gallery";

export const TrackLoadingBar: React.FC = () => (
  <svg
    width="400"
    height="100"
    viewBox="0 0 400 100"
    style={{ width: "100%", height: "auto", display: "block", borderRadius: 14 }}
    role="img"
    aria-label="Generating card"
  >
    <rect width="400" height="100" rx="14" fill="#09090b" />
    <rect x="24" y="42" width="352" height="16" rx="8" fill="#1f1f23" />
    <rect x="24" y="42" height="16" rx="8" fill="#5865f2">
      <animate attributeName="width" values="24;352;24" dur="1.3s" repeatCount="indefinite" />
    </rect>
  </svg>
);

export const PreviewMediaGallery: React.FC<{
  component: APIV2MediaGallery;
  files?: DraftFile[];
  setImageModalData?: SetImageModalData;
  cdn?: string;
}> = ({ component: gallery, files, setImageModalData, cdn }) => {
  if (gallery.items.every((item) => item.media.url.startsWith("loading://"))) {
    return (
      <div style={{ maxWidth: 520 }}>
        <TrackLoadingBar />
      </div>
    );
  }
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
