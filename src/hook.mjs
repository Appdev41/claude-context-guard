import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const THRESHOLD = parseInt(process.env.CONTEXT_GUARD_THRESHOLD || '40', 10) / 100;
const CRITICAL_THRESHOLD = 0.70;
const CONTEXT_WINDOW = parseInt(process.env.CONTEXT_GUARD_WINDOW || '200000', 10);
const CHARS_PER_TOKEN = 4;
const OVERHEAD_MULTIPLIER = 1.8;
const BASE_TOKENS = 8000;
const STATE_DIR = join(tmpdir(), 'context-guard');

function statePath(sid) {
  return join(STATE_DIR, `${sid}.json`);
}

function loadState(sid) {
  try {
    return JSON.parse(readFileSync(statePath(sid), 'utf8'));
  } catch {
    return { sid, chars: 0, calls: 0, alerted: false, critical: false };
  }
}

function saveState(state) {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(statePath(state.sid), JSON.stringify(state));
}

function estimateTokens(chars) {
  return BASE_TOKENS + Math.round((chars / CHARS_PER_TOKEN) * OVERHEAD_MULTIPLIER);
}

function bar(ratio, width = 30) {
  const filled = Math.min(width, Math.round(ratio * width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function c(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

function fmtK(n) {
  return Math.round(n / 1000) + 'K';
}

function buildAlert(pct, estimated, colorCode, title, hint) {
  const sep = '─'.repeat(44);
  return [
    '',
    c(sep, colorCode),
    c(`  ${title} — ${pct}%`, `${colorCode};1`),
    c(`  ${bar(pct / 100)}  ${fmtK(estimated)}/${fmtK(CONTEXT_WINDOW)}`, colorCode),
    c(`  → ${hint}`, colorCode),
    c(sep, colorCode),
    '',
  ].join('\n');
}

export async function runHook() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return;
  }

  const sid = data.session_id || `p${process.ppid}`;
  const state = loadState(sid);

  const inputChars = JSON.stringify(data.tool_input || '').length;
  const outputRaw = data.tool_result?.text ?? data.tool_output ?? '';
  const outputChars = typeof outputRaw === 'string'
    ? outputRaw.length
    : JSON.stringify(outputRaw).length;

  state.chars += inputChars + outputChars;
  state.calls++;

  const estimated = estimateTokens(state.chars);
  const pct = Math.round((estimated / CONTEXT_WINDOW) * 100);

  if (pct >= 70 && !state.critical) {
    state.critical = true;
    state.alerted = true;
    const msg = buildAlert(pct, estimated, '31', 'CONTEXTE CRITIQUE', '/compact URGENT');
    process.stderr.write('\x07' + msg);
    saveState(state);
    process.exit(2);
  }

  if (pct >= THRESHOLD * 100 && !state.alerted) {
    state.alerted = true;
    const msg = buildAlert(pct, estimated, '33', 'ALERTE CONTEXTE', 'Pensez à /compact');
    process.stderr.write('\x07' + msg);
    saveState(state);
    process.exit(2);
  }

  saveState(state);
}

export async function showStatus() {
  if (!existsSync(STATE_DIR)) {
    console.log('Aucune session active.');
    return;
  }

  const files = readdirSync(STATE_DIR).filter(f => f.endsWith('.json'));
  if (!files.length) {
    console.log('Aucune session active.');
    return;
  }

  for (const f of files) {
    try {
      const s = JSON.parse(readFileSync(join(STATE_DIR, f), 'utf8'));
      const est = estimateTokens(s.chars);
      const pct = Math.round((est / CONTEXT_WINDOW) * 100);
      const col = pct >= 70 ? '31' : pct >= THRESHOLD * 100 ? '33' : '32';
      const sep = '─'.repeat(44);

      console.log(`
${c('Context Guard', '1')} — session ${c(s.sid, '36')}
${sep}
  Appels outils:  ${s.calls}
  Tokens estimés: ${c(est.toLocaleString(), `${col};1`)}
  Fenêtre:       ${CONTEXT_WINDOW.toLocaleString()} tokens
  ${c(bar(pct / 100), col)}  ${c(`${pct}%`, `${col};1`)}
${sep}
  Seuil: ${THRESHOLD * 100}%  |  Critique: 70%
  Alerté: ${s.alerted ? 'oui' : 'non'}  |  Critique: ${s.critical ? 'oui' : 'non'}
`);
    } catch { /* skip corrupted state files */ }
  }
}

export async function resetSession() {
  if (!existsSync(STATE_DIR)) {
    console.log('Rien à réinitialiser.');
    return;
  }
  const files = readdirSync(STATE_DIR).filter(f => f.endsWith('.json'));
  for (const f of files) {
    try { unlinkSync(join(STATE_DIR, f)); } catch { /* ignore */ }
  }
  console.log(`${files.length} session(s) réinitialisée(s).`);
}
