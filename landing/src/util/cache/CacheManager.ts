export type ResolvableAPIChannelType =
  | "text"
  | "voice"
  | "thread"
  | "forum"
  | "media"
  | "post";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Resolutions = Record<string, any>;

export type CacheManager = {
  state: Resolutions;
  resolveMany: (requests: Set<string>) => void;
};
