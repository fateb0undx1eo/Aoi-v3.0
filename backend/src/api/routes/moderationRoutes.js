import { Router } from 'express';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';

export function createModerationRoutes({ moderationService, accessControlService, client }) {
  const router = Router();

  // Health check - no auth required
  router.get('/health', (req, res) => {
    res.json({ ok: true, service: 'moderation' });
  });
  
  // Apply auth middleware to all guild routes
  router.use('/:guildId/*', requireGuildAccess(accessControlService));

  // Get moderation config for a guild
  router.get('/:guildId/config', async (req, res, next) => {
    try {
      const config = await moderationService.getModConfig(req.params.guildId);
      res.status(200).json({ config });
    } catch (error) {
      next(error);
    }
  });

  // Update moderation config
  router.put('/:guildId/config', async (req, res, next) => {
    try {
      await moderationService.updateModConfig(req.params.guildId, req.body);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // Get moderation cases for a guild
  router.get('/:guildId/cases', async (req, res, next) => {
    try {
      const { userId, type, active, limit = 50, offset = 0 } = req.query;
      const cases = await moderationService.listCases(req.params.guildId, {
        userId,
        type,
        active: active === 'true',
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      res.status(200).json({ cases });
    } catch (error) {
      next(error);
    }
  });

  // Create a new moderation case
  router.post('/:guildId/cases', async (req, res, next) => {
    try {
      const { targetUserId, type, reason, durationSeconds } = req.body;
      const moderatorId = req.user?.id;
      if (!moderatorId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      const { guildId } = req.params;
      
      // Fetch usernames from Discord
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
      
      // Execute Discord punishment
      try {
        const member = await guild.members.fetch(targetUserId);
        switch (type) {
          case 'WARN':
            // Send warning DM
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
        console.warn('Failed to execute Discord punishment:', punishError.message);
        // Continue to create case even if Discord action fails
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

  // Update a case (reason, active status)
  router.patch('/:guildId/cases/:caseId', async (req, res, next) => {
    try {
      const { reason, active } = req.body;
      await moderationService.updateCase(req.params.guildId, req.params.caseId, {
        reason,
        active
      });
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // Delete a case
  router.delete('/:guildId/cases/:caseId', async (req, res, next) => {
    try {
      await moderationService.deleteCase(req.params.guildId, req.params.caseId);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // Get active mutes/timeouts
  router.get('/:guildId/active', async (req, res, next) => {
    try {
      const active = await moderationService.getActivePunishments(req.params.guildId);
      res.status(200).json({ active });
    } catch (error) {
      next(error);
    }
  });

  // Revoke/unpunish (unban, unmute, etc)
  router.post('/:guildId/revoke', async (req, res, next) => {
    try {
      const { caseId, reason } = req.body;
      const moderatorId = req.user?.id;
      if (!moderatorId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      
      await moderationService.revokePunishment({
        guildId: req.params.guildId,
        caseId,
        moderatorUserId: moderatorId,
        reason
      });
      
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  // Get warn count for a user
  router.get('/:guildId/warns/:userId', async (req, res, next) => {
    try {
      const count = await moderationService.getWarnCount(req.params.guildId, req.params.userId);
      res.status(200).json({ count, userId: req.params.userId });
    } catch (error) {
      next(error);
    }
  });

  // Clear warns for a user
  router.delete('/:guildId/warns/:userId', async (req, res, next) => {
    try {
      const moderatorId = req.user?.id;
      if (!moderatorId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }
      await moderationService.clearWarns(req.params.guildId, req.params.userId, moderatorId);
      res.status(200).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
