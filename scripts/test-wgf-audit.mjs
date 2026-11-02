import assert from 'node:assert/strict';
import { formatAuditEventType, WGF_AUDIT_EVENT_LABELS } from '../src/lib/wgfAuditLog.js';

assert.equal(formatAuditEventType('phase_pass'), WGF_AUDIT_EVENT_LABELS.phase_pass);
assert.equal(formatAuditEventType('unknown_event'), 'unknown_event');

console.log('wgfAuditLog: OK');
