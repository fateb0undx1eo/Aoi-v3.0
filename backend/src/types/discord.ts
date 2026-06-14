import type {
  ChatInputCommandInteraction,
  MessageContextMenuCommandInteraction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  AnySelectMenuInteraction,
  AutocompleteInteraction,
} from 'discord.js';

export type DiscordInteraction =
  | ChatInputCommandInteraction
  | MessageContextMenuCommandInteraction
  | ButtonInteraction
  | StringSelectMenuInteraction
  | AnySelectMenuInteraction
  | ModalSubmitInteraction
  | AutocompleteInteraction;

export type CommandInteraction = ChatInputCommandInteraction | MessageContextMenuCommandInteraction;

export interface GuildCacheEntry {
  id: string;
  config: Record<string, any>;
  moduleConfigs: Record<string, any>;
  commandConfigs: Record<string, any>;
  lastFetched: number;
}
