import { buildClaudeArgs } from '../pipeline/runner.ts';
import { join } from 'node:path';

const shimPath = join(process.cwd(), 'scripts', 'http-runner-shim.mjs');
const baseArgs = buildClaudeArgs({
  prompt: 'Test prompt',
  projectDir: '/tmp/project',
  model: 'llama3.2:latest',
  roleFile: '/tmp/role-a.md',
  resume: undefined,
  jsonSchema: undefined,
  effort: 'high',
});

const shimArgs = [shimPath, '--provider', 'ccr:lmstudio', ...baseArgs];
console.log('shim args:', JSON.stringify(shimArgs, null, 2));
