import { RoleSelectMenuBuilder, StringSelectMenuBuilder, ContainerBuilder, TextDisplayBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { cidRole } from './customIds.js';
import { hexToColorName } from './colors.js';
import type { InteractionResult } from '../../types/index.js';

export function buildRoleSelect(userId: string): RoleSelectMenuBuilder {
  return new RoleSelectMenuBuilder()
    .setCustomId(cidRole('role', userId))
    .setPlaceholder('Select a role...')
    .setMinValues(1)
    .setMaxValues(1);
}

export function buildActionSelect(userId: string, roleId: string): StringSelectMenuBuilder {
  return new StringSelectMenuBuilder()
    .setCustomId(cidRole('action', userId, roleId))
    .setPlaceholder('Choose an action...')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions([
      { label: 'CHANGE COLOR', value: 'color' },
      { label: 'CHANGE NAME', value: 'name' },
      { label: 'CHANGE ICON', value: 'icon' }
    ]);
}

export function buildInitialContainer(): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder()
        .setContent('# Role Editor')
    );
}

export function buildPreviewContainer(userId: string, hex: string, roleId: string, roleName: string, colorOverride: string | null, hex2: string | null, hex3: string | null): ContainerBuilder {
  const colorName = colorOverride || hexToColorName(hex);
  let colorText: string;
  if (hex3) {
    colorText = `**Style:** Holographic\n**Primary:** ${hex.toUpperCase()}\n**Secondary:** ${hex2!.toUpperCase()}\n**Tertiary:** ${hex3.toUpperCase()}`;
  } else if (hex2) {
    colorText = `**Gradient:** ${hex.toUpperCase()} → ${hex2.toUpperCase()}`;
  } else {
    colorText = `**Color:** ${colorName}\n**Hex:** ${hex.toUpperCase()}`;
  }
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Role Editor')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Role:** <@&${roleId}>\n${colorText}`)
    )
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL('attachment://preview.png')
      )
    );
}

export function buildResultContainer(message: string): ContainerBuilder {
  return new ContainerBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent('# Role Editor')
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(message)
    );
}

export function errorEdit(message: string): InteractionResult {
  return { type: 'EDIT_REPLY', components: [buildResultContainer(message)] } as InteractionResult;
}
