#!/usr/bin/env node
/**
 * Test ticket command payloads
 */

import { buildTicketPanelPayload, buildUserManagementPayload } from './backend/src/modules/tickets/components/payloads.js';

console.log('Testing buildTicketPanelPayload...');
try {
  const payload = buildTicketPanelPayload();
  console.log('✓ Payload created:', JSON.stringify(payload, null, 2).substring(0, 200));
} catch (error) {
  console.error('✗ Error:', error.message);
  console.error(error.stack);
}

console.log('\nTesting buildUserManagementPayload...');
try {
  const payload = buildUserManagementPayload('123456789');
  console.log('✓ Payload created:', JSON.stringify(payload, null, 2).substring(0, 200));
} catch (error) {
  console.error('✗ Error:', error.message);
  console.error(error.stack);
}
