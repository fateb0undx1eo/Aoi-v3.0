import { MessageFlags } from 'discord.js';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimString(value, maxLength = 1000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeBlocks(blocks) {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks
    .map((block) => ({
      type: String(block?.type ?? '').trim(),
      content: trimString(block?.content, 2000)
    }))
    .filter((block) => block.type === 'text' || block.type === 'image' || block.type === 'separator');
}

function buildContainerComponents(blocks) {
  const components = [];

  for (const block of normalizeBlocks(blocks)) {
    if (block.type === 'text' && block.content) {
      components.push({
        type: 10,
        content: block.content
      });
      continue;
    }

    if (block.type === 'image' && block.content) {
      components.push({
        type: 12,
        items: [
          {
            media: { url: block.content },
            description: 'DM broadcast image'
          }
        ]
      });
      continue;
    }

    if (block.type === 'separator') {
      components.push({
        type: 14,
        divider: true,
        spacing: 1
      });
    }
  }

  if (!components.length) {
    return [];
  }

  return [
    {
      type: 17,
      components
    }
  ];
}

function normalizePayload(payload = {}) {
  const rawDelaySeconds = Number(payload.delay_seconds);
  const delaySeconds = Number.isFinite(rawDelaySeconds) ? rawDelaySeconds : 1.2;

  return {
    target_mode: payload.target_mode === 'everyone' ? 'everyone' : 'member',
    member_id: trimString(payload.member_id, 32),
    message_text: trimString(payload.message_text, 1800),
    container_blocks: normalizeBlocks(payload.container_blocks),
    delay_seconds: Math.min(10, Math.max(0.5, delaySeconds))
  };
}

export class DmBroadcastService {
  constructor({ client, placeholderEngine }) {
    this.client = client;
    this.placeholderEngine = placeholderEngine;
    this.jobs = new Map();
  }

  async resolveGuild(guildId) {
    return this.client.guilds.cache.get(guildId) ?? await this.client.guilds.fetch(guildId).catch(() => null);
  }

  async resolveTargetMembers(guild, payload) {
    if (payload.target_mode === 'member') {
      if (!payload.member_id) {
        throw new Error('Select a member to DM.');
      }

      const member = guild.members.cache.get(payload.member_id) ?? await guild.members.fetch(payload.member_id).catch(() => null);
      if (!member || member.user?.bot) {
        throw new Error('That member could not be found for DM delivery.');
      }

      return [member];
    }

    if (guild.members.cache.size < guild.memberCount) {
      const fetchedMembers = await guild.members.fetch().catch(() => null);
      if (!fetchedMembers && guild.members.cache.size === 0) {
        throw new Error('Unable to load guild members for DM delivery.');
      }
    }

    return guild.members.cache.filter((member) => !member.user?.bot).map((member) => member);
  }

  renderPlainMessage(template, member) {
    return this.placeholderEngine.render(template, {
      mention: `<@${member.id}>`,
      username: member.user.username,
      server_name: member.guild.name,
      user: {
        id: member.id,
        username: member.user.username
      }
    });
  }

  async sendToMember(member, payload) {
    const plainMessage = this.renderPlainMessage(payload.message_text, member);
    const components = buildContainerComponents(payload.container_blocks);
    const allowsMention = plainMessage.includes(`<@${member.id}>`);

    const messagePayload = {
      ...(plainMessage ? { content: plainMessage } : {}),
      ...(components.length ? { flags: MessageFlags.IsComponentsV2, components } : {}),
      allowedMentions: allowsMention ? { users: [member.id] } : { parse: [] }
    };

    if (!messagePayload.content && !messagePayload.components) {
      throw new Error('Add a plain message or at least one container block before sending.');
    }

    try {
      await member.send(messagePayload);
    } catch (error) {
      if (!messagePayload.components || !plainMessage) {
        throw error;
      }

      await member.send({
        content: plainMessage,
        allowedMentions: allowsMention ? { users: [member.id] } : { parse: [] }
      });
    }
  }

  pruneJobs() {
    const cutoff = Date.now() - (60 * 60 * 1000);

    for (const [jobId, job] of this.jobs.entries()) {
      const finishedAt = job.finished_at ? new Date(job.finished_at).getTime() : 0;
      if (finishedAt && finishedAt < cutoff) {
        this.jobs.delete(jobId);
      }
    }
  }

  createJob({ guildId, payload, requested }) {
    this.pruneJobs();

    const job = {
      id: randomUUID(),
      guild_id: guildId,
      status: 'queued',
      target_mode: payload.target_mode,
      requested,
      processed: 0,
      sent: 0,
      failed: 0,
      started_at: new Date().toISOString(),
      finished_at: null,
      error: null
    };

    this.jobs.set(job.id, job);
    return job;
  }

  getJob(guildId, jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.guild_id !== guildId) {
      return null;
    }

    return { ...job };
  }

  async runJob(jobId, members, payload) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'running';

    try {
      let firstError = null;

      for (const member of members) {
        try {
          await this.sendToMember(member, payload);
          job.sent += 1;
        } catch (error) {
          job.failed += 1;
          if (!firstError) {
            firstError = error instanceof Error ? error.message : 'DM delivery failed.';
          }
        }

        job.processed += 1;

        if (payload.target_mode === 'everyone') {
          await sleep(Math.round(payload.delay_seconds * 1000));
        }
      }

      if (job.sent === 0 && job.failed > 0) {
        job.status = 'failed';
        job.error = firstError || 'DM broadcast failed.';
        job.finished_at = new Date().toISOString();
        logger.warn(`DM broadcast failed for guild ${job.guild_id}`, {
          job_id: job.id,
          error: job.error,
          requested: job.requested,
          sent: job.sent,
          failed: job.failed
        });
        return;
      }

      job.status = 'completed';
      job.finished_at = new Date().toISOString();
      logger.info(`DM broadcast completed for guild ${job.guild_id}`, {
        job_id: job.id,
        requested: job.requested,
        sent: job.sent,
        failed: job.failed
      });
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'DM broadcast failed.';
      job.finished_at = new Date().toISOString();
      logger.warn(`DM broadcast failed for guild ${job.guild_id}`, {
        job_id: job.id,
        error: job.error
      });
    }
  }

  async startBroadcast(guildId, rawPayload) {
    const payload = normalizePayload(rawPayload);
    const guild = await this.resolveGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found.');
    }

    const members = await this.resolveTargetMembers(guild, payload);
    if (!members.length) {
      throw new Error('No members matched this DM target.');
    }

    const job = this.createJob({
      guildId,
      payload,
      requested: members.length
    });

    logger.info(`DM broadcast queued for guild ${guildId}`, {
      job_id: job.id,
      target_mode: payload.target_mode,
      requested: members.length
    });

    this.runJob(job.id, members, payload);
    return this.getJob(guildId, job.id);
  }
}
