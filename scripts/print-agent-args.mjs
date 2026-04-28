import { buildClaudeArgs } from '../pipeline/runner.ts';

const opts = {
  prompt: 'User says: Hello there',
  projectDir: '/tmp/project',
  model: 'claude-sonnet-4-6',
  roleFile: '/tmp/role-a.md',
  resume: undefined,
  jsonSchema: undefined,
  effort: 'high',
};

const args = buildClaudeArgs(opts);
console.log('built args:', JSON.stringify(args, null, 2));
