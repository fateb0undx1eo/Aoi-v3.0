import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from '../../utils/logger.js';

async function listModuleEntrypoints(baseDir) {
  const dirs = await fs.readdir(baseDir, { withFileTypes: true });
  const entries = [];

  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const full = path.join(baseDir, entry.name, 'index.js');
    try {
      await fs.access(full);
      entries.push(full);
    } catch {
      // Skip folders without module entrypoint.
    }
  }

  return entries;
}

function validateDefinition(definition, type) {
  if (!definition?.name) throw new Error(`${type} has no name`);
  if (!Array.isArray(definition.commands)) throw new Error(`${type} ${definition.name} missing commands[]`);
  if (!Array.isArray(definition.events)) throw new Error(`${type} ${definition.name} missing events[]`);
  if (!definition.configSchema || typeof definition.configSchema !== 'object') {
    throw new Error(`${type} ${definition.name} missing configSchema object`);
  }
}

export async function loadDefinitions(directory, type, registry) {
  const files = await listModuleEntrypoints(directory);
  logger.info(`Loading ${type}s from ${directory}`);

  for (const file of files) {
    const loaded = await import(pathToFileURL(file).href);
    const definition = loaded.default;
    validateDefinition(definition, type);
    registry.registerModule(definition, type);
    logger.info(`Loaded ${type}: ${definition.name}`);
  }
}
