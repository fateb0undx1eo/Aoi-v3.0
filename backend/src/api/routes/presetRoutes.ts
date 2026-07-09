import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireGuildAccess } from '../middleware/requireGuildAccess.js';
import type { AuthService } from '../../services/authService.js';
import type { AccessControlService } from '../../services/accessControlService.js';
import type { PresetService } from '../../services/presetService.js';

interface Deps {
  authService: AuthService;
  accessControlService: AccessControlService;
  presetService: PresetService;
}

export async function presetRoutes(instance: FastifyInstance, opts: { deps: Deps }): Promise<void> {
  const { authService, accessControlService, presetService } = opts.deps;
  const authHook = requireAuth(authService);
  const guildAccessHook = requireGuildAccess(accessControlService);

  instance.addHook('preHandler', authHook);

  instance.get('/:guildId/announcements/presets', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const presets = await presetService.listPresets(guildId);
    return reply.status(200).send({ presets });
  });

  instance.post('/:guildId/announcements/presets', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const guildId = params.guildId!;
    const body = request.body as Record<string, any>;

    if (!body.name?.trim()) {
      return reply.status(400).send({ error: 'Preset name is required' });
    }
    if (body.kind !== 'draft' && body.kind !== 'template') {
      return reply.status(400).send({ error: 'Preset kind must be "draft" or "template"' });
    }

    const preset = await presetService.createPreset(guildId, {
      name: String(body.name).trim().slice(0, 80),
      kind: body.kind,
      data: body.data || {},
    });
    return reply.status(201).send({ preset });
  });

  instance.put('/:guildId/announcements/presets/:presetId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const presetId = params.presetId!;
    const body = request.body as Record<string, any>;

    const payload: Record<string, any> = {};
    if (body.name !== undefined) payload.name = String(body.name).trim().slice(0, 80);
    if (body.kind !== undefined) {
      if (body.kind !== 'draft' && body.kind !== 'template') {
        return reply.status(400).send({ error: 'Preset kind must be "draft" or "template"' });
      }
      payload.kind = body.kind;
    }
    if (body.data !== undefined) payload.data = body.data;

    await presetService.updatePreset(presetId, payload);
    return reply.status(200).send({ ok: true });
  });

  instance.delete('/:guildId/announcements/presets/:presetId', { preHandler: guildAccessHook }, async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const presetId = params.presetId!;

    await presetService.deletePreset(presetId);
    return reply.status(200).send({ ok: true });
  });
}
