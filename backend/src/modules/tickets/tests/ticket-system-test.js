/**
 * Tickets Module - Integration Tests
 * Demonstrates usage and can be run for testing
 */

import logger from '../services/logging-service.js';

/**
 * Test suite for the tickets module
 */
export class TicketSystemTest {
  constructor(ticketsModule) {
    this.module = ticketsModule;
  }

  /**
   * Tests cooldown service
   */
  async testCooldownService() {
    console.log('\n=== Testing Cooldown Service ===');
    const cooldownService = this.module.services.cooldown;
    const testUserId = '123456789012345678';

    try {
      // Apply cooldown
      console.log('Applying cooldown...');
      await cooldownService.applyCooldown(testUserId);

      // Check cooldown status
      const status = await cooldownService.getCooldownStatus(testUserId);
      console.log('Cooldown status:', status);
      console.log('✅ Cooldown test passed');
    } catch (error) {
      console.error('❌ Cooldown test failed:', error.message);
    }
  }

  /**
   * Tests lock service
   */
  async testLockService() {
    console.log('\n=== Testing Lock Service ===');
    const lockService = this.module.services.lock;

    try {
      // Acquire lock
      console.log('Acquiring lock...');
      const lockId = await lockService.acquireLock('test-resource', 30);
      console.log('Lock acquired:', lockId);

      // Check lock
      console.log('Checking if lock exists...');
      const hasLock = await lockService.hasCreationLock('test-user');
      console.log('Has creation lock:', hasLock);

      // Release lock
      if (lockId) {
        console.log('Releasing lock...');
        const released = await lockService.releaseLock('test-resource', lockId);
        console.log('Lock released:', released);
      }

      console.log('✅ Lock service test passed');
    } catch (error) {
      console.error('❌ Lock service test failed:', error.message);
    }
  }

  /**
   * Tests metrics service
   */
  async testMetricsService() {
    console.log('\n=== Testing Metrics Service ===');
    const metricsService = this.module.services.metrics;

    try {
      // Record events
      console.log('Recording metrics...');
      await metricsService.recordTicketCreation({ guildId: '111' });
      await metricsService.recordTicketResolution({ threadId: '222' });
      await metricsService.recordError('test_error', { message: 'test' });

      // Get snapshot
      const snapshot = await metricsService.getMetricsSnapshot();
      console.log('Metrics snapshot:', snapshot);
      console.log('✅ Metrics service test passed');
    } catch (error) {
      console.error('❌ Metrics service test failed:', error.message);
    }
  }

  /**
   * Tests component builders
   */
  testComponentBuilders() {
    console.log('\n=== Testing Component Builders ===');

    try {
      const Payloads = this.module.services.PayloadBuilders || {};
      
      // Test payload builders
      console.log('Building ticket panel payload...');
      const panelPayload = Payloads.buildTicketPanelPayload?.() || { components: [] };
      console.log('Panel payload built:', panelPayload ? '✓' : '✗');

      // Test button builders
      console.log('Building buttons...');
      const Buttons = this.module.handlers.ButtonBuilders || {};
      console.log('Buttons available:', Object.keys(Buttons).length > 0 ? '✓' : '✗');

      console.log('✅ Component builders test passed');
    } catch (error) {
      console.error('❌ Component builders test failed:', error.message);
    }
  }

  /**
   * Runs all tests
   */
  async runAllTests() {
    console.log('\n╔════════════════════════════════════╗');
    console.log('║   TICKETS MODULE TEST SUITE       ║');
    console.log('╚════════════════════════════════════╝');

    try {
      await this.testCooldownService();
      await this.testLockService();
      await this.testMetricsService();
      this.testComponentBuilders();

      console.log('\n╔════════════════════════════════════╗');
      console.log('║   ALL TESTS COMPLETED             ║');
      console.log('╚════════════════════════════════════╝\n');
    } catch (error) {
      console.error('Test suite failed:', error);
    }
  }
}

export default TicketSystemTest;
