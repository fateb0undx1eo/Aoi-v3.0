import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Client } from 'discord.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { logger } from '../../utils/logger.js';
import type { BotContext } from '../../types/index.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { ModerationService } from '../../services/moderationService.js';

export function createModerationRoutes({ moderationService, accessControlService, client }: {
  moderationService: ModerationService;
  accessControlService: AccessControlService;
  client: Client;
}): Router {
  const router = Router();

  router.get('/health', (req: Request, res: Response) => {
    res.json({ ok: true, service: 'moderation' });
  });

  router.use('/:guildId/*', requireGuildAccess(accessControlService));

  router.use('/:guildId/cases', rateLimiter({ windowMs: 60_000, maxRequests: 20, keyPrefix: 'mod_cases' }));
  router.use('/:guildId/revoke', rateLimiter({ windowMs: 60_000, maxRequests: 10, keyPrefix: 'mod_revoke' }));

  router.get('/:guildId/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const config = await moderationService.getModConfig(guildId);
      res.status(200).json({ config });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:guildId/config', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      await moderationService.updateModConfig(guildId, req.body);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/cases', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const userId = req.query.userId as string;
      const type = req.query.type as string;
      const active = req.query.active as string;
      const limit = (req.query.limit as string) ?? '50';
      const offset = (req.query.offset as string) ?? '0';
      const cases = await moderationService.listCases(guildId, {
        userId,
        type,
        active: active === 'true',
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });
      res.status(200).json({ cases });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:guildId/cases', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { targetUserId, type, reason, durationSeconds } = req.body as Record<string, any>;
      const moderatorId = (req.user as Record<string, any>)?.id;
      if (!moderatorId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const guildId = req.params.guildId as string;

      const guild = client?.guilds?.cache?.get(guildId);
      let targetUsername = 'Unknown';
      let moderatorUsername = 'Unknown';

      if (!guild) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      try {
        const targetMember = await guild.members.fetch(targetUserId);
        targetUsername = targetMember.user.tag;
      } catch {}
      try {
        const modMember = await guild.members.fetch(moderatorId);
        moderatorUsername = modMember.user.tag;
      } catch {}

      try {
        const member = await guild.members.fetch(targetUserId);
        switch (type) {
          case 'WARN':
            try {
              await member.send(`⚠️ **Warning** from ${guild.name}\nReason: ${reason || 'No reason provided'}`);
            } catch {}
            break;
          case 'KICK':
            await member.kick(reason || 'Kicked by moderator');
            break;
          case 'BAN':
            await member.ban({ reason: reason || 'Banned by moderator', deleteMessageSeconds: 0 });
            break;
          case 'TIMEOUT':
            if (durationSeconds) {
              await member.timeout(durationSeconds * 1000, reason || 'Timed out by moderator');
            }
            break;
          case 'TEMPBAN':
            await member.ban({ reason: reason || 'Temp banned by moderator', deleteMessageSeconds: 0 });
            break;
        }
      } catch (punishError) {
        logger.warn({ err: punishError }, 'Failed to execute Discord punishment');
      }

      const caseData = await moderationService.createCase({
        guildId,
        targetUserId,
        targetUsername,
        moderatorUserId: moderatorId,
        moderatorUsername,
        type,
        reason,
        durationSeconds
      });

      res.status(201).json({ case: caseData });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:guildId/cases/:caseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const caseId = req.params.caseId as string;
      const { reason, active } = req.body as Record<string, any>;
      await moderationService.updateCase(guildId, caseId, {
        reason,
        active
      });
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:guildId/cases/:caseId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const caseId = req.params.caseId as string;
      await moderationService.deleteCase(guildId, caseId);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/active', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const active = await moderationService.getActivePunishments(guildId);
      res.status(200).json({ active });
    } catch (error) {
      next(error);
    }
  });

  router.post('/:guildId/revoke', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const { caseId, reason } = req.body as Record<string, any>;
      const moderatorId = (req.user as Record<string, any>)?.id;
      if (!moderatorId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      await moderationService.revokePunishment({
        guildId,
        caseId,
        moderatorUserId: moderatorId,
        reason
      });

      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.get('/:guildId/warns/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const userId = req.params.userId as string;
      const count = await moderationService.getWarnCount(guildId, userId);
      res.status(200).json({ count, userId });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:guildId/warns/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const guildId = req.params.guildId as string;
      const userId = req.params.userId as string;
      const moderatorId = (req.user as Record<string, any>)?.id;
      if (!moderatorId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      await moderationService.clearWarns(guildId, userId, moderatorId);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
