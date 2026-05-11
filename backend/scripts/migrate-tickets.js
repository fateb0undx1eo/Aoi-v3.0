#!/usr/bin/env node

/**
 * Migration script for enhanced ticket system
 * Run this script to apply database changes and migrate existing tickets
 */

import { supabase } from '../src/database/supabase.js';
import { createClient } from 'redis';
import { env } from '../src/core/config/env.js';

async function runMigration() {
  console.log('🚀 Starting Ticket System Migration...\n');

  try {
    // Test database connection
    console.log('📊 Testing database connection...');
    const { data, error } = await supabase.from('guilds').select('count').limit(1);
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
    console.log('✅ Database connection successful');

    // Test Redis connection
    console.log('\n🔴 Testing Redis connection...');
    const redis = createClient({ url: env.redis.url });
    await redis.connect();
    await redis.ping();
    console.log('✅ Redis connection successful');
    await redis.disconnect();

    // Check if new tables exist
    console.log('\n🔍 Checking table structure...');
    
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .in('table_name', ['tickets', 'ticket_cooldowns']);

    if (tableError) {
      console.log('⚠️  Could not check table structure, assuming migration needed');
    } else {
      const tableNames = tables?.map(t => t.table_name) || [];
      const hasTickets = tableNames.includes('tickets');
      const hasCooldowns = tableNames.includes('ticket_cooldowns');

      console.log(`  - tickets table: ${hasTickets ? '✅' : '❌'}`);
      console.log(`  - ticket_cooldowns table: ${hasCooldowns ? '✅' : '❌'}`);

      if (hasTickets && hasCooldowns) {
        console.log('\n✅ Migration appears to be complete');
        return;
      }
    }

    console.log('\n📝 Migration required. Please run the SQL migration file:');
    console.log('   supabase/migrations/20260511_enhanced_tickets_schema.sql');
    console.log('\nYou can run this via:');
    console.log('   1. Supabase Dashboard -> SQL Editor');
    console.log('   2. Or: supabase db push');
    console.log('   3. Or: psql < your-connection-string < migrations/20260511_enhanced_tickets_schema.sql');

    // Check if we should migrate existing data
    console.log('\n🔄 Checking for existing tickets to migrate...');
    
    const { data: oldTickets, error: oldError } = await supabase
      .from('tickets')
      .select('*')
      .limit(1);

    if (oldError && oldError.code !== 'PGRST116') { // PGRST116 = relation not found
      console.log('⚠️  Error checking existing tickets:', oldError.message);
    } else if (oldTickets && oldTickets.length > 0) {
      console.log('📋 Found existing tickets. Data migration will be needed after schema update.');
      
      // Show sample of existing data structure
      console.log('\nSample existing ticket structure:');
      console.log(JSON.stringify(oldTickets[0], null, 2));
    } else {
      console.log('✅ No existing tickets found, fresh installation');
    }

    console.log('\n🎯 Migration Checklist:');
    console.log('□ Run SQL migration: 20260511_enhanced_tickets_schema.sql');
    console.log('□ Verify Redis is running and accessible');
    console.log('□ Update .env with REDIS_URL if needed');
    console.log('□ Restart bot application');
    console.log('□ Test ticket creation and resolution');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(() => {
      console.log('\n✨ Migration check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigration };
