#!/usr/bin/env node

import { supabase } from '../src/database/supabase.js';
import { createClient } from 'redis';
import { env } from '../src/core/config/env.js';
import { logger } from '../src/utils/logger.js';

async function runMigration() {
  logger.info('🚀 Starting Ticket System Migration...\n');

  try {
    logger.info('📊 Testing database connection...');
    const { data, error } = await supabase.from('guilds').select('count').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
    logger.info('✅ Database connection successful');

    logger.info('\n🔴 Testing Redis connection...');
    const redis = createClient({ url: env.redis.url });
    await redis.connect();
    await redis.ping();
    logger.info('✅ Redis connection successful');
    await redis.disconnect();

    logger.info('\n🔍 Checking table structure...');
    
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['tickets', 'ticket_cooldowns']);

    if (tableError) {
      logger.warn('⚠️  Could not check table structure, assuming migration needed');
    } else {
      const tableNames = tables?.map(t => t.table_name) || [];
      const hasTickets = tableNames.includes('tickets');
      const hasCooldowns = tableNames.includes('ticket_cooldowns');

      logger.info(`  - tickets table: ${hasTickets ? '✅' : '❌'}`);
      logger.info(`  - ticket_cooldowns table: ${hasCooldowns ? '✅' : '❌'}`);

      if (hasTickets && hasCooldowns) {
        logger.info('\n✅ Migration appears to be complete');
        return;
      }
    }

    logger.info('\n📝 Migration required. Please run the SQL migration file:');
    logger.info('   supabase/migrations/20260511_enhanced_tickets_schema.sql');
    logger.info('\nYou can run this via:');
    logger.info('   1. Supabase Dashboard -> SQL Editor');
    logger.info('   2. Or: supabase db push');
    logger.info('   3. Or: psql < your-connection-string < migrations/20260511_enhanced_tickets_schema.sql');

    logger.info('\n🔄 Checking for existing tickets to migrate...');
    
    const { data: oldTickets, error: oldError } = await supabase
      .from('tickets')
      .select('*')
      .limit(1);

    if (oldError && oldError.code !== 'PGRST116') {
      logger.warn({ err: oldError }, '⚠️  Error checking existing tickets');
    } else if (oldTickets && oldTickets.length > 0) {
      logger.info('📋 Found existing tickets. Data migration will be needed after schema update.');
      logger.info('\nSample existing ticket structure:');
      logger.info(JSON.stringify(oldTickets[0], null, 2));
    } else {
      logger.info('✅ No existing tickets found, fresh installation');
    }

    logger.info('\n🎯 Migration Checklist:');
    logger.info('□ Run SQL migration: 20260511_enhanced_tickets_schema.sql');
    logger.info('□ Verify Redis is running and accessible');
    logger.info('□ Update .env with REDIS_URL if needed');
    logger.info('□ Restart bot application');
    logger.info('□ Test ticket creation and resolution');

  } catch (error) {
    logger.error({ err: error }, '\n❌ Migration failed');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => {
      logger.info('\n✨ Migration check completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error({ err: error }, '\n💥 Migration script failed');
      process.exit(1);
    });
}

export { runMigration };
