import { logger } from '../utils/logger.js';

function classifyFault(reason: any): string {
  const message = String(reason?.message || reason || '').toLowerCase();
  if (message.includes('redis')) return 'redis';
  if (message.includes('supabase') || message.includes('fetch failed')) return 'database_or_network';
  if (message.includes('discord') || message.includes('rest')) return 'discord';
  if (message.includes('out of memory') || message.includes('heap')) return 'fatal_memory';
  return 'application';
}

export function registerRuntimeFaultHandlers({ runtimeState, shutdown }: Record<string, any> = {}): void {
  const handleFatal = async (kind: string, error: Error): Promise<void> => {
    const classification = classifyFault(error);
    logger.error('Runtime fatal fault', { kind, classification, error });
    runtimeState?.setDegraded?.('process', classification, { kind });

    if (classification === 'fatal_memory') {
      process.exit(1);
      return;
    }

    if (typeof shutdown === 'function') {
      await shutdown(kind, { exitCode: 1, forceExit: true }).catch((shutdownError: Error) => {
        logger.error('Graceful shutdown after fatal fault failed', shutdownError);
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  };

  process.on('unhandledRejection', (reason: any) => {
    const classification = classifyFault(reason);
    logger.error('Unhandled promise rejection', { classification, error: reason });
    runtimeState?.setDegraded?.('async_runtime', classification);
  });

  process.on('uncaughtException', (error: Error) => {
    handleFatal('uncaughtException', error);
  });

  process.on('warning', (warning: Error) => {
    logger.warn('Process warning', {
      name: warning.name,
      message: warning.message,
      stack: warning.stack
    });
  });
}
