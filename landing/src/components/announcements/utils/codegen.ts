import type { QueryDataMessageData, APIActionRowComponent } from "../types";

export function generateDiscordJs(msg: QueryDataMessageData): string {
  const lines: string[] = [];
  lines.push("// discord.js v14");
  lines.push("import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } from 'discord.js';");
  lines.push("");
  lines.push("// Build the message");
  lines.push("const message = {");
  if (msg.content) lines.push(`  content: ${JSON.stringify(msg.content)},`);

  if (msg.embeds?.length) {
    const embedLines: string[] = [];
    msg.embeds.forEach((e, i) => {
      embedLines.push(`    new EmbedBuilder()`);
      if (e.title) embedLines.push(`      .setTitle(${JSON.stringify(e.title)})`);
      if (e.description) embedLines.push(`      .setDescription(${JSON.stringify(e.description)})`);
      if (e.url) embedLines.push(`      .setURL(${JSON.stringify(e.url)})`);
      if (e.color) embedLines.push(`      .setColor(${e.color})`);
      if (e.author?.name) embedLines.push(`      .setAuthor({ name: ${JSON.stringify(e.author.name)}${e.author.icon_url ? `, iconURL: ${JSON.stringify(e.author.icon_url)}` : ""}${e.author.url ? `, url: ${JSON.stringify(e.author.url)}` : ""} })`);
      if (e.fields?.length) {
        e.fields.forEach((f) => {
          embedLines.push(`      .addFields({ name: ${JSON.stringify(f.name)}, value: ${JSON.stringify(f.value)}${f.inline ? ", inline: true" : ""} })`);
        });
      }
      if (e.footer?.text) embedLines.push(`      .setFooter({ text: ${JSON.stringify(e.footer.text)}${e.footer.icon_url ? `, iconURL: ${JSON.stringify(e.footer.icon_url)}` : ""} })`);
      if (e.image?.url) embedLines.push(`      .setImage(${JSON.stringify(e.image.url)})`);
      if (e.thumbnail?.url) embedLines.push(`      .setThumbnail(${JSON.stringify(e.thumbnail.url)})`);
      if (e.timestamp) embedLines.push(`      .setTimestamp(new Date(${JSON.stringify(e.timestamp)}))`);
      embedLines.push(`    ,`);
    });
    lines.push(`  embeds: [`);
    lines.push(...embedLines);
    lines.push(`  ],`);
  }

  if (msg.components?.length && msg.components[0]?.type === 1) {
    lines.push(`  components: [`);
    (msg.components as APIActionRowComponent[]).forEach((row) => {
      lines.push(`    new ActionRowBuilder().addComponents(`);
      row.components.forEach((comp: any) => {
        if (comp.type === 2) {
          lines.push(`      new ButtonBuilder()`);
          lines.push(`        .setStyle(${comp.style}),`);
          if (comp.label) lines.push(`        .setLabel(${JSON.stringify(comp.label)})`);
          if (comp.emoji) lines.push(`        .setEmoji(${JSON.stringify(comp.emoji)})`);
          if (comp.style === 5) {
            lines.push(`        .setURL(${JSON.stringify(comp.url || "https://discord.com")})`);
          } else {
            lines.push(`        .setCustomId(${JSON.stringify(comp.custom_id || `btn_${Date.now()}`)})`);
          }
          if (comp.disabled) lines.push(`        .setDisabled(true)`);
        }
        if (comp.type === 3) {
          lines.push(`      new StringSelectMenuBuilder()`);
          lines.push(`        .setCustomId(${JSON.stringify(comp.custom_id || `select_${Date.now()}`)})`);
          if (comp.placeholder) lines.push(`        .setPlaceholder(${JSON.stringify(comp.placeholder)})`);
          lines.push(`        .setMinValues(${comp.min_values || 1})`);
          lines.push(`        .setMaxValues(${comp.max_values || 1})`);
          if (comp.options?.length) {
            lines.push(`        .addOptions(`);
            comp.options.forEach((opt: any) => {
              lines.push(`          { label: ${JSON.stringify(opt.label)}, value: ${JSON.stringify(opt.value)}${opt.description ? `, description: ${JSON.stringify(opt.description)}` : ""}${opt.emoji ? `, emoji: ${JSON.stringify(opt.emoji)}` : ""} },`);
            });
            lines.push(`        )`);
          }
        }
      });
      lines.push(`    ),`);
    });
    lines.push(`  ],`);
  }

  if (msg.flags) lines.push(`  flags: ${msg.flags},`);
  lines.push("};");
  lines.push("");
  lines.push("// Send the message");
  lines.push("channel.send(message);");
  return lines.join("\n");
}

export function generateDiscordPy(msg: QueryDataMessageData): string {
  const lines: string[] = [];
  lines.push("# discord.py 2.x");
  lines.push("import discord");
  lines.push("from discord import Embed, ButtonStyle, ActionRow, Button, SelectMenu, SelectOption");
  lines.push("");

  if (msg.content) {
    lines.push(`content = ${JSON.stringify(msg.content)}`);
  }

  if (msg.embeds?.length) {
    msg.embeds.forEach((e, i) => {
      lines.push("");
      lines.push(`embed${i > 0 ? i : ""} = Embed(`);
      if (e.title) lines.push(`    title=${JSON.stringify(e.title)},`);
      if (e.description) lines.push(`    description=${JSON.stringify(e.description)},`);
      if (e.color) lines.push(`    color=${e.color},`);
      if (e.url) lines.push(`    url=${JSON.stringify(e.url)}`);
      lines.push(`)`);
      if (e.author?.name) {
        lines.push(`embed${i > 0 ? i : ""}.set_author(name=${JSON.stringify(e.author.name)}${e.author.icon_url ? `, icon_url=${JSON.stringify(e.author.icon_url)}` : ""}${e.author.url ? `, url=${JSON.stringify(e.author.url)}` : ""})`);
      }
      if (e.fields?.length) {
        e.fields.forEach((f) => {
          lines.push(`embed${i > 0 ? i : ""}.add_field(name=${JSON.stringify(f.name)}, value=${JSON.stringify(f.value)}${f.inline ? ", inline=True" : ""})`);
        });
      }
      if (e.footer?.text) {
        lines.push(`embed${i > 0 ? i : ""}.set_footer(text=${JSON.stringify(e.footer.text)}${e.footer.icon_url ? `, icon_url=${JSON.stringify(e.footer.icon_url)}` : ""})`);
      }
      if (e.image?.url) lines.push(`embed${i > 0 ? i : ""}.set_image(url=${JSON.stringify(e.image.url)})`);
      if (e.thumbnail?.url) lines.push(`embed${i > 0 ? i : ""}.set_thumbnail(url=${JSON.stringify(e.thumbnail.url)})`);
      if (e.timestamp) lines.push(`embed${i > 0 ? i : ""}.timestamp = ${JSON.stringify(e.timestamp)}`);
    });
  }

  if (msg.components?.length && msg.components[0]?.type === 1) {
    lines.push("");
    lines.push("components = [");
    (msg.components as APIActionRowComponent[]).forEach((row) => {
      lines.push("    ActionRow(");
      row.components.forEach((comp: any) => {
        if (comp.type === 2) {
          const styleNames: Record<number, string> = { 1: "ButtonStyle.blurple", 2: "ButtonStyle.grey", 3: "ButtonStyle.green", 4: "ButtonStyle.red", 5: "ButtonStyle.link" };
          lines.push(`        Button(style=${styleNames[comp.style] || "ButtonStyle.blurple"},`);
          if (comp.label) lines.push(`               label=${JSON.stringify(comp.label)},`);
          if (comp.emoji) lines.push(`               emoji=${JSON.stringify(comp.emoji)},`);
          if (comp.style === 5) {
            lines.push(`               url=${JSON.stringify(comp.url || "https://discord.com")},`);
          } else {
            lines.push(`               custom_id=${JSON.stringify(comp.custom_id || `btn_${Date.now()}`)},`);
          }
          if (comp.disabled) lines.push(`               disabled=True,`);
          lines.push(`              ),`);
        }
        if (comp.type === 3) {
          lines.push(`        SelectMenu(`);
          lines.push(`            custom_id=${JSON.stringify(comp.custom_id || `select_${Date.now()}`)},`);
          if (comp.placeholder) lines.push(`            placeholder=${JSON.stringify(comp.placeholder)},`);
          lines.push(`            min_values=${comp.min_values || 1},`);
          lines.push(`            max_values=${comp.max_values || 1},`);
          if (comp.options?.length) {
            lines.push(`            options=[`);
            comp.options.forEach((opt: any) => {
              lines.push(`                SelectOption(label=${JSON.stringify(opt.label)}, value=${JSON.stringify(opt.value)}${opt.description ? `, description=${JSON.stringify(opt.description)}` : ""}${opt.emoji ? `, emoji=${JSON.stringify(opt.emoji)}` : ""}),`);
            });
            lines.push(`            ],`);
          }
          lines.push(`        ),`);
        }
      });
      lines.push("    ),");
    });
    lines.push("]");
  }

  lines.push("");
  const embedVars = msg.embeds?.length ? `embeds=[${msg.embeds.map((_, i) => `embed${i > 0 ? i : ""}`).join(", ")}]` : "";
  const compVars = msg.components?.length ? `components=components` : "";
  const contentVar = msg.content ? `content=content` : "";
  const args = [contentVar, embedVars, compVars].filter(Boolean).join(", ");
  lines.push(`await channel.send(${args})`);
  return lines.join("\n");
}
