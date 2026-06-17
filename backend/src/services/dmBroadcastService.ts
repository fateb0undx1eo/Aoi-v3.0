import type { Client, Guild, GuildMember } from 'discord.js';
import { MessageFlags } from 'discord.js';
import { nanoid } from 'nanoid';
import { logger } from '../utils/logger.js';

interface ContainerBlock {
  type: string;
  content: string;
}

interface TextComponent {
  type: 10;
  content: string;
}

interface MediaItem {
  media: { url: string };
}

interface ImageComponent {
  type: 12;
  items: MediaItem[];
}

interface SeparatorComponent {
  type: 14;
  divider: true;
  spacing: number;
}

type ContainerComponent = TextComponent | ImageComponent | SeparatorComponent;

interface ContainerActionRow {
  type: 17;
  components: ContainerComponent[];
}

interface NormalizedPayload {
  target_mode: 'everyone' | 'member';
  member_id: string;
  plain_messages: string[];
  container_blocks: ContainerBlock[];
  delay_seconds: number;
}

interface DmJob {
  id: string;
  guild_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  target_mode: string;
  requested: number;
  processed: number;
  sent: number;
  failed: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
}

interface CreateJobParams {
  guildId: string;
  payload: NormalizedPayload;
  requested: number;
}

interface QueuedBroadcastData {
  guildId: string;
  jobId: string;
  memberIds: string[];
  payload: NormalizedPayload;
}

interface PlaceholderEngineLike {
  render(template: string, context: Record<string, any>): string;
}

interface JobQueueLike {
  enqueue(queue: string, data: QueuedBroadcastData, opts: { idempotencyKey: string }): Promise<any>;
}

interface DmBroadcastServiceOptions {
  client: Client;
  placeholderEngine: PlaceholderEngineLike;
  jobQueue: JobQueueLike | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trimString(value: unknown, maxLength: number = 1000): string {
  return String(value ?? '').trim().slice(0, maxLength);
}

function normalizeBlocks(blocks: unknown): ContainerBlock[] {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return (blocks as any[])
    .map((block: any) => ({
      type: String(block?.type ?? '').trim(),
      content: trimString(block?.content, 2000)
    }))
    .filter((block: ContainerBlock) => block.type === 'text' || block.type === 'image' || block.type === 'separator');
}

function normalizePlainMessages(rawMessages: unknown, fallbackMessageText: string = ''): string[] {
  const normalizedMessages: string[] = Array.isArray(rawMessages)
    ? (rawMessages as any[])
        .map((message: any) => {
          if (typeof message === 'string') {
            return trimString(message, 1800);
          }

          return trimString(message?.content, 1800);
        })
        .filter(Boolean)
    : [];

  if (normalizedMessages.length > 0) {
    return normalizedMessages;
  }

  const fallbackMessage = trimString(fallbackMessageText, 1800);
  return fallbackMessage ? [fallbackMessage] : [];
}

function buildContainerComponents(blocks: unknown): ContainerActionRow[] {
  const components: ContainerComponent[] = [];

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
            media: { url: block.content }
          }
        ]
      });
      continue;
    }

    if (block.type === 'separator') {
      components.push({
        type: 14,
        divider: true as const,
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

function normalizePayload(payload: Record<string, any> = {}): NormalizedPayload {
  const rawDelaySeconds = Number(payload.delay_seconds);
  const delaySeconds = Number.isFinite(rawDelaySeconds) ? rawDelaySeconds : 1.2;

  return {
    target_mode: payload.target_mode === 'everyone' ? 'everyone' : 'member',
    member_id: trimString(payload.member_id, 32),
    plain_messages: normalizePlainMessages(payload.plain_messages, payload.message_text),
    container_blocks: normalizeBlocks(payload.container_blocks),
    delay_seconds: Math.min(10, Math.max(0.5, delaySeconds))
  };
}

export class DmBroadcastService {
  private client: Client;
  private placeholderEngine: PlaceholderEngineLike;
  private jobQueue: JobQueueLike | null;
  private jobs: Map<string, DmJob>;

  constructor({ client, placeholderEngine, jobQueue = null }: DmBroadcastServiceOptions) {
    this.client = client;
    this.placeholderEngine = placeholderEngine;
    this.jobQueue = jobQueue;
    this.jobs = new Map();
  }

  async resolveGuild(guildId: string): Promise<Guild | null> {
    return this.client.guilds.cache.get(guildId) ?? await this.client.guilds.fetch(guildId).catch(() => null);
  }

  async resolveTargetMembers(guild: Guild, payload: NormalizedPayload): Promise<GuildMember[]> {
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

    return guild.members.cache.filter((member: GuildMember) => !member.user?.bot).map((member: GuildMember) => member);
  }

  renderPlainMessage(template: string, member: GuildMember): string {
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

  renderPlainMessages(messages: string[], member: GuildMember): string[] {
    return normalizePlainMessages(messages).map((message: string) => this.renderPlainMessage(message, member)).filter(Boolean);
  }

  async sendToMember(member: GuildMember, payload: NormalizedPayload): Promise<void> {
    const plainMessages = this.renderPlainMessages(payload.plain_messages, member);
    const components = buildContainerComponents(payload.container_blocks);
    if (!plainMessages.length && !components.length) {
      throw new Error('Add a plain message or at least one container block before sending.');
    }

    for (const plainMessage of plainMessages) {
      const allowsMention = plainMessage.includes(`<@${member.id}>`);

      await member.send({
        content: plainMessage,
        allowedMentions: allowsMention ? { users: [member.id] } : { parse: [] }
      });

      await sleep(150);
    }

    if (components.length) {
      await member.send({
        flags: MessageFlags.IsComponentsV2,
        components,
        allowedMentions: { parse: [] }
      });
    }
  }

  pruneJobs(): void {
    const cutoff = Date.now() - (60 * 60 * 1000);

    for (const [jobId, job] of this.jobs.entries()) {
      const finishedAt = job.finished_at ? new Date(job.finished_at).getTime() : 0;
      if (finishedAt && finishedAt < cutoff) {
        this.jobs.delete(jobId);
      }
    }
  }

  createJob({ guildId, payload, requested }: CreateJobParams): DmJob {
    this.pruneJobs();

    const job: DmJob = {
      id: nanoid(),
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

  getJob(guildId: string, jobId: string): DmJob | null {
    const job = this.jobs.get(jobId);
    if (!job || job.guild_id !== guildId) {
      return null;
    }

    return { ...job };
  }

  async runJob(jobId: string, members: GuildMember[], payload: NormalizedPayload): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      return;
    }

    job.status = 'running';

    try {
      let firstError: string | null = null;

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

  async startBroadcast(guildId: string, rawPayload: Record<string, any>): Promise<DmJob | null> {
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

    if (this.jobQueue) {
      await this.jobQueue.enqueue(
        'dm_broadcast',
        { guildId, jobId: job.id, memberIds: members.map((member) => member.id), payload },
        { idempotencyKey: `dm_broadcast:${job.id}` }
      );
    } else {
      this.runJob(job.id, members, payload).catch((error) => {
        logger.warn(`DM broadcast worker crashed for guild ${guildId}`, {
          job_id: job.id,
          error: error instanceof Error ? error.message : 'unknown error'
        });
      });
    }
    return this.getJob(guildId, job.id);
  }

  async runQueuedBroadcast({ guildId, jobId, memberIds, payload }: QueuedBroadcastData): Promise<void> {
    const guild = await this.resolveGuild(guildId);
    if (!guild) {
      throw new Error('Guild not found for queued DM broadcast.');
    }

    const results = await Promise.allSettled(
      (memberIds ?? []).map(async (memberId) => {
        const member = guild.members.cache.get(memberId) ?? await guild.members.fetch(memberId).catch(() => null);
        return member && !member.user?.bot ? member : null;
      })
    );
    const members: GuildMember[] = results
      .filter((r): r is PromiseFulfilledResult<GuildMember | null> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((m): m is GuildMember => m !== null);

    await this.runJob(jobId, members, payload);
  }
}
