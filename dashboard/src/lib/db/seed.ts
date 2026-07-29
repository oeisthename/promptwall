import { db } from './index';
import { policies } from './schema';
import * as crypto from 'crypto';

async function seed() {
  console.log('Seeding database...');
  
  // Create default policies
  await db.insert(policies).values([
    {
      name: 'Block specific paths',
      description: 'Block access to sensitive paths',
      action: 'block',
      enabled: true,
      priority: 100,
      match: "tool_call.path == '/etc/passwd' or tool_call.path == '/var/log'",
      plane: 'output',
      severity: 'critical',
      agent: '*'
    },
    {
      name: 'Allowlist specific domains',
      description: 'Only allow connections to trusted domains',
      action: 'allow',
      enabled: true,
      priority: 200,
      match: "tool_call.url in ['api.internal.com', 'api.partner.com']",
      plane: 'output',
      severity: 'low',
      agent: '*'
    },
    {
      name: 'Require approval for destructive actions',
      description: 'Require human approval for delete or drop commands',
      action: 'require_approval',
      enabled: true,
      priority: 150,
      match: "tool_call.command in ['drop', 'delete', 'rm']",
      plane: 'output',
      severity: 'high',
      agent: '*'
    },
    {
      name: 'Redact PII in outputs',
      description: 'Mask emails and phone numbers',
      action: 'redact',
      enabled: true,
      priority: 300,
      match: "tool_call.result contains PII",
      plane: 'input',
      severity: 'medium',
      agent: '*'
    }
  ]).onConflictDoNothing();

  console.log('Database seeded successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
