import { useEffect, useState } from "react";
import { CoolIcon } from "@/components/icons/CoolIcon";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import type { ImageModalProps } from "../types";

export function ImageModal({
  images,
  startIndex,
  clear,
}: ImageModalProps & {
  clear: () => void;
  children?: never;
}) {
  const titleId = "image-modal-title";
  const [index, setIndex] = useState(startIndex);
  const image = images && index !== undefined ? images[index] : undefined;

  useEffect(() => {
    if (images && startIndex !== undefined) setIndex(startIndex);
  }, [images, startIndex]);

  return (
    <DialogPrimitive.Root
      open={!!images && startIndex !== undefined}
      onOpenChange={clear}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/90 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-labelledby={titleId}
          onClick={(e) => {
            if (e.target === e.currentTarget) clear();
          }}
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "max-w-[90vw] max-h-[90vh] w-full h-full flex items-center justify-center",
          )}
        >
          <DialogPrimitive.Title id={titleId} className="sr-only">
            Image preview
          </DialogPrimitive.Title>
          {images && images.length > 1 && index !== undefined && (
            <button
              type="button"
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white p-2"
              onClick={() => {
                let siblingIndex = index - 1;
                if (siblingIndex < 0) siblingIndex = images.length - 1;
                setIndex(siblingIndex);
              }}
            >
              <CoolIcon icon="Chevron_Left" size={32} />
            </button>
          )}
          {image ? (
            <div className="max-h-[calc(100vh-4rem)] overflow-hidden flex items-center justify-center">
              <img
                src={image.url}
                alt={image.alt ?? ""}
                className="rounded-lg max-h-[calc(100vh-4rem)] w-auto object-contain"
              />
            </div>
          ) : null}
          {images && images.length > 1 && index !== undefined && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-white/80 hover:text-white p-2"
              onClick={() => {
                let siblingIndex = index + 1;
                if (siblingIndex > images.length - 1) siblingIndex = 0;
                setIndex(siblingIndex);
              }}
            >
              <CoolIcon icon="Chevron_Right" size={32} />
            </button>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
