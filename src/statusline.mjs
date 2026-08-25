function bar(ratio, width = 15) {
  const filled = Math.min(width, Math.round(ratio * width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function c(text, code) {
  return `\x1b[${code}m${text}\x1b[0m`;
}

export async function runStatusLine() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) raw += chunk;

  let data;
  try { data = JSON.parse(raw); } catch { data = {}; }

  const pct = Math.round(
    data.context_window?.used_percentage
    ?? data.contextWindow?.usedPercentage
    ?? data.context_window?.percentage
    ?? 0
  );

  const model = data.model?.display_name ?? data.model?.name ?? '';

  const ratio = pct / 100;
  const colorCode = pct >= 70 ? '31' : pct >= 40 ? '33' : '32';
  const prefix = pct >= 70 ? '!! ' : pct >= 40 ? '⚡ ' : '';

  const barStr = c(bar(ratio), colorCode);
  const pctStr = c(`${pct}%`, `${colorCode};1`);

  const parts = [`${prefix}${barStr} ${pctStr}`];
  if (model) parts.push(model);

  process.stdout.write(parts.join(' · '));
}
