import type {
  APIEmbed,
  APIEmbedField,
  APIEmbedImage,
  DraftFile,
  LinkEmbedStrategy,
  SetImageModalData,
} from "../types";
import { DISCORD } from "../constants";
import { isGifVideoUrl, getImageUri } from "../utils/files";
import { decimalToHex } from "../utils/color";
import { twJoin } from "tailwind-merge";
import { Markdown, type FeatureConfig } from "../utils/markdown";
import { formatTimestamp } from "../utils/message";
import Gallery from "./Gallery";

function formatEmbedTimestamp(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    if (d.toDateString() === now.toDateString()) return `Today at ${time}`;
    if (d.toDateString() === yesterday.toDateString())
      return `Yesterday at ${time}`;
    return formatTimestamp(iso);
  } catch {
    return iso;
  }
}

export default function EmbedPreview({
  embed,
  extraImages,
  files,
  setImageModalData,
  isLinkEmbed,
  linkEmbedStrategy,
  cdn,
}: {
  embed: APIEmbed;
  extraImages?: APIEmbedImage[];
  files?: DraftFile[];
  setImageModalData?: SetImageModalData;
  isLinkEmbed?: boolean;
  linkEmbedStrategy?: LinkEmbedStrategy;
  cdn?: string;
}) {
  const footer: APIEmbed["footer"] =
    linkEmbedStrategy === "mastodon"
      ? embed.provider
        ? { text: embed.provider.name ?? "" }
        : embed.footer
      : embed.footer;

  const images: APIEmbedImage[] = [];
  if (embed.image?.url) images.push(embed.image);
  if (extraImages) images.push(...extraImages);

  const cdnGifVideoUrl = (url: string) => isGifVideoUrl(url, cdn) ?? undefined;

  const fieldLines: APIEmbedField[][] = [];
  for (const field of embed.fields ?? []) {
    const currentLine = fieldLines[fieldLines.length - 1];
    if (!currentLine) {
      fieldLines.push([field]);
    } else {
      const lastField = currentLine[currentLine.length - 1];
      if (field.inline && lastField?.inline && currentLine.length < 3) {
        currentLine.push(field);
      } else {
        fieldLines.push([field]);
      }
    }
  }

  return (
    <div>
      <div
        className={twJoin(
          "rounded dark:text-[#dbdee1] inline-grid pr-4 pb-4 pl-3 pt-[2px]",
          "bg-white dark:bg-[#2f3136] border border-l-4 border-[#E2E2E4] border-l-[#D9D9DC] dark:border-[#434349] dark:border-l-[#4A4A50]",
        )}
        style={{
          ...(typeof embed.color === "number"
            ? { borderLeftColor: decimalToHex(embed.color) }
            : undefined),
          maxWidth: 520,
        }}
      >
        {(!linkEmbedStrategy || linkEmbedStrategy === "link") && embed.provider?.name ? (
          <div className="min-w-0 mt-2 font-normal text-xs whitespace-break-spaces break-words text-background-secondary-dark dark:text-primary-230">
            {embed.provider.url ? (
              <a
                className="hover:underline"
                style={{ color: DISCORD.textLink, textDecoration: "none" }}
                href={embed.provider.url}
                target="_blank"
                rel="noreferrer nofollow ugc"
              >
                {embed.provider.name}
              </a>
            ) : (
              <span>{embed.provider.name}</span>
            )}
          </div>
        ) : null}

        {embed.author?.name && (
          <div className="min-w-0 flex mt-2">
            {embed.author.icon_url && !isLinkEmbed && (
              cdnGifVideoUrl(embed.author.icon_url) ? (
                <video
                  src={cdnGifVideoUrl(embed.author.icon_url)}
                  className="h-6 w-6 mr-2 object-contain rounded-full"
                  autoPlay
                  muted
                  loop
                />
              ) : (
                <img
                  className="h-6 w-6 mr-2 object-contain rounded-full"
                  src={getImageUri(embed.author.icon_url, files)}
                  alt="Author"
                />
              )
            )}
            <p className="font-medium text-sm whitespace-pre-wrap break-words my-auto">
              {embed.author.url ? (
                <a
                  className="hover:underline"
                  style={{ color: DISCORD.textLink, textDecoration: "none" }}
                  href={embed.author.url}
                  target="_blank"
                  rel="noreferrer nofollow ugc"
                >
                  {embed.author.name}
                </a>
              ) : (
                <span>{embed.author.name}</span>
              )}
            </p>
          </div>
        )}

        {embed.title && (
          <div className="min-w-0 text-base leading-[1.375] font-semibold mt-2 break-words">
            {embed.url ? (
              <a
                href={embed.url}
                className="text-blue-430 dark:text-blue-345 hover:underline underline-offset-1"
                target="_blank"
                rel="noreferrer nofollow ugc"
              >
                {isLinkEmbed ? (
                  <p>{embed.title}</p>
                ) : (
                  <Markdown content={embed.title} features="title" />
                )}
              </a>
            ) : isLinkEmbed ? (
              <p>{embed.title}</p>
            ) : (
              <Markdown content={embed.title} features="title" />
            )}
          </div>
        )}

        {embed.description &&
          !(
            isLinkEmbed &&
            linkEmbedStrategy === "link" &&
            embed.video
          ) && (
            <div className="text-sm font-normal mt-2 whitespace-pre-line min-w-0 break-words">
              {isLinkEmbed ? (
                <p>{embed.description}</p>
              ) : (
                <Markdown content={embed.description} features="full" />
              )}
            </div>
          )}

        {fieldLines.length > 0 && (
          <div className="text-sm leading-[1.125rem] grid col-start-1 col-end-2 gap-2 mt-2 min-w-0">
            {fieldLines.map((line, i) => (
              <div
                key={`message-preview-embed-fields-row-${i}`}
                className="contents"
                data-field-row-index={i}
              >
                {line.map((field, colIndex) => {
                  let inlineBound = [1, 13];
                  if (field.inline) {
                    if (line.length === 3) {
                      if (colIndex === 2) {
                        inlineBound = [9, 13];
                      } else if (colIndex === 1) {
                        inlineBound = [5, 9];
                      } else {
                        inlineBound = [1, 5];
                      }
                    } else if (line.length === 2) {
                      if (colIndex === 1) {
                        inlineBound = [7, 13];
                      } else {
                        inlineBound = [1, 7];
                      }
                    }
                  }

                  return (
                    <div
                      key={`message-preview-embed-fields-row-${i}-field-${colIndex}`}
                      data-field-subrow-index={i}
                      style={{
                        gridColumn: `${inlineBound[0]} / ${inlineBound[1]}`,
                      }}
                    >
                      <div className="font-semibold mb-px break-words">
                        <Markdown content={field.name ?? ""} features="title" />
                      </div>
                      <div
                        className="font-normal whitespace-pre-line break-words"
                        style={{
                          // @ts-expect-error
                          "--font-size": "1rem",
                        }}
                      >
                        <Markdown
                          content={field.value ?? ""}
                          features={
                            { extend: "full", headings: false } as FeatureConfig
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {images.length > 0 && (
          <div className="mt-2 min-w-0">
            <Gallery
              attachments={images.map(
                (image) =>
                  ({
                    content_type: image.url.endsWith(".gif")
                      ? "image/gif"
                      : "image/png",
                    url: getImageUri(image.url, files),
                  }) as any,
              )}
              setImageModalData={setImageModalData}
              cdn={cdn}
            />
          </div>
        )}

        {embed.video?.url && (
          <div className="mt-2 min-w-0">
            <Gallery
              attachments={
                [
                  {
                    content_type: "video/mp4",
                    url: embed.video.url,
                  },
                ] as any
              }
              setImageModalData={setImageModalData}
            />
          </div>
        )}

        {embed.thumbnail?.url && (
          <button
            type="button"
            className="flex mt-2 ml-4 justify-self-end h-fit"
            style={{ gridArea: "1 / 2 / 8 / 3" }}
            onClick={() => {
              if (setImageModalData) {
                setImageModalData({
                  images: [
                    { url: getImageUri(embed.thumbnail?.url ?? "", files) },
                  ],
                  startIndex: 0,
                });
              }
            }}
          >
            {cdnGifVideoUrl(embed.thumbnail.url) ? (
              <video
                src={cdnGifVideoUrl(embed.thumbnail.url)}
                className="rounded max-w-[80px] max-h-20"
                autoPlay
                muted
                loop
              />
            ) : (
              <img
                src={getImageUri(embed.thumbnail.url, files)}
                className="rounded max-w-[80px] max-h-20"
                alt="Thumbnail"
              />
            )}
          </button>
        )}

        {(footer?.text ||
          (embed.timestamp && linkEmbedStrategy === "mastodon")) && (
          <div className="min-w-0 flex mt-2 font-medium text-xs text-primary-600 dark:text-primary-230">
            {footer?.text && (
              <>
                {footer.icon_url && (
                  cdnGifVideoUrl(footer.icon_url) ? (
                    <video
                      src={cdnGifVideoUrl(footer.icon_url)}
                      className="h-5 w-5 mr-2 object-contain rounded-full"
                      autoPlay
                      muted
                      loop
                    />
                  ) : (
                    <img
                      className="h-5 w-5 mr-2 object-contain rounded-full"
                      src={getImageUri(footer.icon_url, files)}
                      alt="Footer"
                    />
                  )
                )}
                <p className="whitespace-pre-wrap break-words my-auto">
                  {footer.text}
                </p>
              </>
            )}
            {embed.timestamp && (
              <>
                {footer?.text && <p className="mx-1">•</p>}
                <p className="whitespace-pre-wrap break-words my-auto">
                  {formatEmbedTimestamp(embed.timestamp)}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
