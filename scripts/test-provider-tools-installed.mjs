import { execSync } from 'node:child_process';

function which(cmd) {
  try {
    return execSync(`which ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return null;
  }
}

function tryCmd(cmd) {
  try {
    const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], timeout: 12000 }).toString();
    return { ok: true, sample: out.slice(0, 220), cmd };
  } catch (err) {
    const stderr = err?.stderr ? String(err.stderr) : String(err.message || err);
    return { ok: false, sample: stderr.slice(0, 220), cmd };
  }
}

const checks = [
  { name: 'claude', probes: ['claude --help'] },
  { name: 'ccr', probes: ['ccr --help', 'ccr model --help', 'ccr code --help'] },
  { name: 'occ', probes: ['occ --help'] },
  { name: 'openclaude', probes: ['openclaude --help'] },
  { name: 'ollama', probes: ['ollama --help'] },
  { name: 'lmstudio', probes: ['lmstudio --help'] },
];

const results = checks.map((c) => {
  const path = which(c.name);
  if (!path) {
    return { name: c.name, path: null, available: false, probeOk: false, probeCmd: null, probeSample: 'not on PATH' };
  }

  let best = { ok: false, sample: 'all probes failed', cmd: c.probes[0] };
  for (const cmd of c.probes) {
    const probe = tryCmd(cmd);
    if (probe.ok) {
      best = probe;
      break;
    }
    if (!best.ok && probe.sample && probe.sample.length > best.sample.length) {
      best = probe;
    }
  }

  return {
    name: c.name,
    path,
    available: true,
    probeOk: best.ok,
    probeCmd: best.cmd,
    probeSample: best.sample,
  };
});

console.log(JSON.stringify(results, null, 2));
