import { MessageFlags } from 'discord.js';
import type { BotContext, InteractionResult } from '../../../types/index.js';
import type { ButtonInteraction, Message } from 'discord.js';
import {
  pendingDrops,
  FUN_ACTION_PREFIX,
  getTypeTitle,
  buildTemplateContext,
  renderTemplate,
  buildContainer,
  buildGenericResolvedComponents,
  scheduleMessageDelete,
  scheduleFollowUpDelete,
  clearPendingDrop,
  formatClaimedAt
} from '../helpers.js';

export default {
  name: 'interactionCreate',
  async execute(interaction: ButtonInteraction, context: BotContext): Promise<InteractionResult | void> {
    const { services, placeholderEngine } = context as any;

    if (interaction.isCommand()) return;
    if (!interaction.isButton() || !interaction.customId.startsWith(`${FUN_ACTION_PREFIX}:`)) return;

    const [, , token, action] = interaction.customId.split(':');
    if (!token || (action !== 'smash' && action !== 'pass')) {
      return { type: 'REPLY' as const, message: 'That drop action is no longer valid.', ephemeral: true };
    }

    const pending = pendingDrops.get(token);
    if (!pending) {
      return { type: 'REPLY' as const, message: 'This drop expired. Use the slash command again.', ephemeral: true };
    }
    if (pending.guildId !== interaction.guildId!) {
      return { type: 'REPLY' as const, message: 'This drop belongs to another server context.', ephemeral: true };
    }
    if (pending.resolved) {
      return { type: 'REPLY' as const, message: 'This drop has already been resolved.', ephemeral: true };
    }

    pending.resolved = true;
    clearPendingDrop(token);

    const claimedAt = formatClaimedAt(new Date());
    let dmStatus = 'Check your DMs.';

    if (action === 'smash') {
      const dmContext = buildTemplateContext({
        type: pending.type, asset: pending.asset, guildName: pending.guildName,
        summonerId: pending.summonerId, actorId: interaction.user.id, claimerId: interaction.user.id,
        claimedAt, commandName: pending.type, maxUses: pending.config.max_uses_per_member,
        windowSeconds: pending.config.cooldown_window_seconds, dmStatus
      });
      const dmTitle = renderTemplate(placeholderEngine, pending.config.dm_title_template, `You claimed your ${pending.type}`, dmContext);
      const dmBody = renderTemplate(placeholderEngine, pending.config.dm_body_template, `Server: ${pending.guildName}\nClaimed at: ${claimedAt}`, dmContext);

      const dmDelivered = await interaction.user.send({
        flags: MessageFlags.IsComponentsV2,
        components: buildContainer({ title: dmTitle, body: dmBody, asset: pending.asset }),
        allowedMentions: { parse: [] }
      }).then(() => true).catch(() => false);

      dmStatus = dmDelivered ? 'Check your DMs.' : 'I could not DM the claim details, so keep this message instead.';
    }

    const templateContext = buildTemplateContext({
      type: pending.type, asset: pending.asset, guildName: pending.guildName,
      summonerId: pending.summonerId, actorId: interaction.user.id,
      claimerId: action === 'smash' ? interaction.user.id : '', claimedAt, commandName: pending.type,
      maxUses: pending.config.max_uses_per_member, windowSeconds: pending.config.cooldown_window_seconds, dmStatus
    });

    if (action === 'smash') {
      const title = renderTemplate(placeholderEngine, pending.config.claim_title_template, `${getTypeTitle(pending.type)} Claimed`, templateContext);
      const body = renderTemplate(placeholderEngine, pending.config.claim_body_template, `<@${interaction.user.id}> claimed this ${pending.type}. ${dmStatus}`, templateContext);
      const components = buildContainer({ title, body, asset: pending.asset });

      if (pending.config.claim_result_visibility === 'public') {
        scheduleMessageDelete(interaction.message, pending.config.resolved_drop_delete_seconds);
        return { type: 'UPDATE', content: null, components, allowedMentions: { parse: [] }, flags: MessageFlags.IsComponentsV2 } as unknown as InteractionResult;
      }

      scheduleMessageDelete(interaction.message, pending.config.resolved_drop_delete_seconds);
      return {
        type: 'MULTI',
        results: [
          { type: 'UPDATE', content: null, components: buildGenericResolvedComponents(pending), allowedMentions: { parse: [] }, flags: MessageFlags.IsComponentsV2 },
          { type: 'FOLLOW_UP', content: '', components, ephemeral: true, allowedMentions: { parse: [] },
            after: async (msg: Message) => { if (msg?.id) scheduleFollowUpDelete(interaction, msg.id, pending.config.ephemeral_notice_delete_seconds); }
          }
        ]
      } as unknown as InteractionResult;
    }

    const passTitle = renderTemplate(placeholderEngine, pending.config.pass_title_template, `${getTypeTitle(pending.type)} Passed`, templateContext);
    const passBody = renderTemplate(placeholderEngine, pending.config.pass_body_template, `<@${interaction.user.id}> passed on this ${pending.type}.`, templateContext);
    const passComponents = buildContainer({ title: passTitle, body: passBody, asset: pending.asset });

    if (pending.config.pass_result_visibility === 'public') {
      scheduleMessageDelete(interaction.message, pending.config.resolved_drop_delete_seconds);
      return { type: 'UPDATE', content: null, components: passComponents, allowedMentions: { parse: [] }, flags: MessageFlags.IsComponentsV2 } as unknown as InteractionResult;
    }

    scheduleMessageDelete(interaction.message, pending.config.resolved_drop_delete_seconds);
    return {
      type: 'MULTI',
      results: [
        { type: 'UPDATE', content: null, components: buildGenericResolvedComponents(pending), allowedMentions: { parse: [] }, flags: MessageFlags.IsComponentsV2 },
        { type: 'FOLLOW_UP', content: '', components: passComponents, ephemeral: true, allowedMentions: { parse: [] },
          after: async (msg: Message) => { if (msg?.id) scheduleFollowUpDelete(interaction, msg.id, pending.config.ephemeral_notice_delete_seconds); }
        }
      ]
    } as unknown as InteractionResult;
  }
};
