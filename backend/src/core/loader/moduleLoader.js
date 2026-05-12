import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from '../../utils/logger.js';

async function listModuleEntrypoints(baseDir) {
  let dirs = [];

  try {
    dirs = await fs.readdir(baseDir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

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

/**
 * Check if default export is an async initialization function
 * Functions are used for modules that require async setup (like tickets module)
 */
function isAsyncInitFunction(loaded) {
  const def = loaded.default;
  return typeof def === 'function' && (
    def.constructor.name === 'AsyncFunction' || 
    def[Symbol.toStringTag] === 'AsyncFunction' ||
    def.toString().includes('async')
  );
}

export async function loadDefinitions(directory, type, registry) {
  const files = await listModuleEntrypoints(directory);
  logger.info(`Loading ${type}s from ${directory}`);

  for (const file of files) {
    const loaded = await import(pathToFileURL(file).href);
    
    // Check if default is an async function (needs runtime initialization)
    if (isAsyncInitFunction(loaded)) {
      // Store the initialization function for later
      const moduleName = path.basename(path.dirname(file));
      registry.registerAsyncModule(moduleName, loaded.default, type);
      logger.info(`Loaded async-init ${type}: ${moduleName}`);
    } else {
      // Regular synchronous module definition
      const definition = loaded.default;
      validateDefinition(definition, type);
      registry.registerModule(definition, type);
      logger.info(`Loaded ${type}: ${definition.name}`);
    }
  }
}
