export type PollType = "vs" | "music";
export type VoteMethod = "buttons" | "reactions";
export type ShowResults = "always" | "after_vote" | "closed";

export interface PollOptionDraft {
  id: string;
  label: string;
  image_url?: string | null;
  emoji?: string | null;
  accent?: string | null;
  track_url?: string | null;
  track_artist?: string | null;
}

export interface PollSettingsDraft {
  vote_method: VoteMethod;
  multi_select: boolean;
  allow_change: boolean;
  show_results: ShowResults;
  accent_color: string;
  background_top: string;
  background_bottom: string;
  ends_at: string | null;
  instructions?: string;
}

export interface PollDraft {
  type: PollType;
  title: string;
  subtitle: string;
  instructions?: string;
  options: PollOptionDraft[];
  settings: PollSettingsDraft;
}

export interface PollRow {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  created_by: string;
  type: PollType;
  title: string;
  subtitle: string;
  options: PollOptionDraft[];
  settings: PollSettingsDraft;
  results: Record<string, number>;
  status: "open" | "closed";
  media_url: string | null;
  created_at: string;
  updated_at: string;
  ends_at: string | null;
}

export interface PollTotals {
  option_id: string;
  count: number;
  pct: number;
}

export const POLL_TYPE_META: Record<
  PollType,
  { label: string; tag: string; description: string; emoji: string; hint: string }
> = {
  vs: {
    label: "Versus",
    tag: "⚔️ VS",
    description: "Ask a question and let people choose between two things — a this-vs-that comparison with a generated VS card",
    emoji: "⚔️",
    hint: "Give every option an image — a VS card is rendered automatically.",
  },
  music: {
    label: "Music Poll",
    tag: "🎵 MUSIC",
    description: "Share tracks — paste a Spotify or YouTube link and vote Listen or Skip",
    emoji: "🎵",
    hint: "Paste a track link; the song name and cover are fetched automatically.",
  },
};

export const REACTION_EMOJIS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export const ACCENT_PRESETS = [
  "#e11d48", "#5865f2", "#23a55a", "#f0b232", "#eb459e",
  "#9b59b6", "#1abc9c", "#f23f42", "#00a8fc", "#ffffff",
];

export const BACKGROUND_PRESETS = [
  "#101014", "#0e0e11", "#14141a", "#1b1b23", "#0a0a1a", "#1a0f0f",
];

export function createDefaultDraft(): PollDraft {
  return {
    type: "vs",
    title: "Goku vs Vegeta",
    subtitle: "",
    instructions: "",
    options: [
      { id: "opt_1", label: "Goku", image_url: null, emoji: null, accent: "#5865f2" },
      { id: "opt_2", label: "Vegeta", image_url: null, emoji: null, accent: "#e11d48" },
    ],
    settings: {
      vote_method: "buttons",
      multi_select: false,
      allow_change: false,
      show_results: "after_vote",
      accent_color: "#e11d48",
      background_top: "#101014",
      background_bottom: "#1b1b23",
      ends_at: null,
      instructions: "",
    },
  };
}