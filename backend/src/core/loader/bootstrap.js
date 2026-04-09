import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDefinitions } from './moduleLoader.js';
import { ModuleRegistry } from '../registry/moduleRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const srcRoot = path.resolve(__dirname, '..', '..');

export async function bootstrapRegistry() {
  const registry = new ModuleRegistry();
  await loadDefinitions(path.join(srcRoot, 'modules'), 'module', registry);
  await loadDefinitions(path.join(srcRoot, 'plugins'), 'plugin', registry);
  return registry;
}
