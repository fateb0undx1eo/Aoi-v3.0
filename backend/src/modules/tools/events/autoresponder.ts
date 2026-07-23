export default {
  name: 'messageCreate',
  async execute(message: any, { services, placeholderEngine }: any): Promise<void> {
    if (!message.guild || message.author.bot) return;

    const autoresponders = await services.toolsService.listAutoresponders(message.guild.id);
    for (const row of autoresponders) {
      if (!row.enabled) continue;
      const content = message.content.toLowerCase();
      const trigger = String(row.trigger_pattern).toLowerCase();
      const matched = row.match_type === 'exact' ? content === trigger : content.includes(trigger);
      if (!matched) continue;

      const rendered = placeholderEngine.render(row.response_template, {
        user: {
          id: message.author.id,
          username: message.author.username
        }
      });
      await message.channel.send({ content: rendered });
    }
  }
};
