import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';

type VectorRec = { id: string; vector: number[]; meta: Record<string, any> };

let VECTORS: VectorRec[] = [];
let DOC_TEXT: Map<string, string> = new Map();
let NORMS: number[] = [];
let LOADED = false;

function loadIndex() {
  if (LOADED) return;
  const vectorsPath = resolve(process.cwd(), 'devSquadMemory/workspace_vectors.jsonl');
  const docsPath = resolve(process.cwd(), 'devSquadMemory/workspace_docs.jsonl');
  if (!existsSync(vectorsPath)) return;
  const lines = readFileSync(vectorsPath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const rec = JSON.parse(line);
      VECTORS.push({ id: rec.id, vector: rec.vector, meta: rec.meta || {} });
    } catch {}
  }
  if (existsSync(docsPath)) {
    for (const line of readFileSync(docsPath, 'utf8').split(/\r?\n/).filter(Boolean)) {
      try {
        const rec = JSON.parse(line);
        DOC_TEXT.set(rec.id, rec.text || '');
      } catch {}
    }
  }

  NORMS = VECTORS.map((v) => Math.sqrt(v.vector.reduce((s, x) => s + x * x, 0)));
  LOADED = true;
}

function cosineScores(queryVec: number[]) {
  const qnorm = Math.sqrt(queryVec.reduce((s, x) => s + x * x, 0)) || 1e-12;
  const scores: number[] = [];
  for (let i = 0; i < VECTORS.length; i++) {
    const v = VECTORS[i].vector;
    let dot = 0;
    for (let j = 0; j < v.length; j++) dot += v[j] * (queryVec[j] || 0);
    const denom = (NORMS[i] || 1e-12) * qnorm;
    scores.push(dot / denom);
  }
  return scores;
}

function computeTopK(scores: number[], k: number) {
  const idxs = scores.map((s, i) => ({ s, i })).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.i);
  return idxs;
}

export async function retrieve(query: string, topK = 5): Promise<Array<{ id: string; score: number; meta: Record<string, any>; text?: string }>> {
  loadIndex();
  if (VECTORS.length === 0) return [];

  // Compute embedding by calling the workspace python helper (uses the venv)
  const pythonCandidates = [
    resolve(process.cwd(), 'devSquadMemory/.venv/bin/python3'),
    resolve(process.cwd(), 'devSquadMemory/.venv/bin/python'),
    'python3',
    'python',
  ];

  const script = resolve(process.cwd(), 'devSquadMemory/query_embed.py');

  const runWithPython = (pythonBin: string) =>
    new Promise<number[]>((resolveP, rejectP) => {
      const args = [script, '--text', query, '--model', 'all-MiniLM-L6-v2'];
      execFile(pythonBin, args, { encoding: 'utf8' }, (err, stdout, stderr) => {
        if (err) return rejectP(err);
        try {
          const obj = JSON.parse(stdout);
          return resolveP(obj.embedding as number[]);
        } catch (e) {
          return rejectP(e instanceof Error ? e : new Error(String(e)));
        }
      });
    });

  let qvec: number[] | null = null;
  for (const py of pythonCandidates) {
    try {
      qvec = await runWithPython(py);
      break;
    } catch (e) {
      // try next
    }
  }
  if (!qvec) return [];

  const scores = cosineScores(qvec);
  const idxs = computeTopK(scores, topK);
  const results = idxs.map((i) => ({ id: VECTORS[i].id, score: scores[i], meta: VECTORS[i].meta, text: DOC_TEXT.get(VECTORS[i].id) }));
  return results;
}

export default { retrieve };
