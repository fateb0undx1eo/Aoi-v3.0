import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { logger } from '../../utils/logger.js';
import type { ModuleRegistry, ModuleDefinition } from '../../types/index.js';

async function listModuleEntrypoints(baseDir: string): Promise<string[]> {
  let dirs: fs.Dirent[] = [];

  try {
    dirs = await fsPromises.readdir(baseDir, { withFileTypes: true }) as unknown as fs.Dirent[];
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const entries: string[] = [];

  for (const entry of dirs) {
    if (!entry.isDirectory()) continue;
    const full = path.join(baseDir, entry.name, 'index.ts');
    try {
      await fsPromises.access(full);
      entries.push(full);
    } catch {
      // Skip folders without module entrypoint.
    }
  }

  return entries;
}

function validateDefinition(definition: any, type: string): void {
  if (!definition?.name) throw new Error(`${type} has no name`);
  if (!Array.isArray(definition.commands)) throw new Error(`${type} ${definition.name} missing commands[]`);
  if (!Array.isArray(definition.events)) throw new Error(`${type} ${definition.name} missing events[]`);
  if (!definition.configSchema || typeof definition.configSchema !== 'object') {
    throw new Error(`${type} ${definition.name} missing configSchema object`);
  }
}

function isAsyncInitFunction(loaded: any): boolean {
  const def = loaded.default;
  return typeof def === 'function' && (
    def.constructor.name === 'AsyncFunction' || 
    def[Symbol.toStringTag] === 'AsyncFunction' ||
    def.toString().includes('async')
  );
}

export async function loadDefinitions(directory: string, type: string, registry: ModuleRegistry): Promise<void> {
  const files = await listModuleEntrypoints(directory);
  logger.info(`Loading ${type}s from ${directory}`);

  for (const file of files) {
    const loaded: any = await import(pathToFileURL(file).href);
    
    if (isAsyncInitFunction(loaded)) {
      const moduleName = path.basename(path.dirname(file));
      registry.registerAsyncModule(moduleName, loaded.default, type);
      logger.info(`Loaded async-init ${type}: ${moduleName}`);
    } else {
      const definition: ModuleDefinition = loaded.default;
      validateDefinition(definition, type);
      registry.registerModule(definition, type);
      logger.info(`Loaded ${type}: ${definition.name}`);
    }
  }
}
