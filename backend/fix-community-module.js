#!/usr/bin/env node
/**
 * Fix script to ensure community module is enabled for all guilds
 */

import * as database from './src/database/repository.js';
import { logger } from './src/utils/logger.js';

async function fixCommunityModule() {
  try {
    logger.info('Ensuring community module is enabled for all guilds...');
    
    // Get all guilds
    const guilds = await database.fetchMany('guilds', (table) => table.select('id'));
    logger.info(`Found ${guilds.length} guilds`);
    
    // Ensure community module config exists and is enabled for each guild
    for (const guild of guilds) {
      const existing = await database.fetchMany('module_configs', (table) =>
        table.select('*').eq('guild_id', guild.id).eq('module_name', 'community')
      );
      
      if (existing.length === 0) {
        // Create default config
        await database.upsertRows('module_configs', {
          guild_id: guild.id,
          module_name: 'community',
          enabled: true,
          config: {}
        }, 'guild_id,module_name');
        logger.info(`✓ Created community module config for guild ${guild.id}`);
      } else if (!existing[0].enabled) {
        // Enable it if disabled
        await database.upsertRows('module_configs', {
          guild_id: guild.id,
          module_name: 'community',
          enabled: true,
          config: existing[0].config || {}
        }, 'guild_id,module_name');
        logger.info(`✓ Enabled community module for guild ${guild.id}`);
      } else {
        logger.info(`✓ Community module already enabled for guild ${guild.id}`);
      }
    }
    
    logger.info('✅ Community module fix completed!\n');
  } catch (error) {
    logger.error('❌ Fix failed:', error);
    process.exit(1);
  }
}

fixCommunityModule();
