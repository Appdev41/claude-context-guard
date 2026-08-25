import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const SETTINGS_PATH = join(homedir(), '.claude', 'settings.json');

const HOOK_ENTRY = {
  matcher: '',
  hooks: [
    {
      type: 'command',
      command: 'context-guard hook',
      timeout: 10000,
    },
  ],
};

function loadSettings() {
  if (!existsSync(SETTINGS_PATH)) return {};
  return JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
}

function saveSettings(settings) {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + '\n');
}

const STATUSLINE_CONFIG = {
  type: 'command',
  command: 'context-guard statusline',
};

function isInstalled(settings) {
  const entries = settings.hooks?.PostToolUse;
  if (!Array.isArray(entries)) return false;
  return entries.some(e =>
    e.hooks?.some(h => h.command?.includes('context-guard'))
  );
}

function hasStatusLine(settings) {
  return settings.statusLine?.command?.includes('context-guard');
}

export async function install() {
  let inPath = true;
  try {
    execSync('which context-guard', { stdio: 'pipe' });
  } catch {
    inPath = false;
  }

  if (!inPath) {
    console.log('\x1b[33mcontext-guard n\'est pas encore dans le PATH.\x1b[0m');
    console.log('  Lancez : npm install -g claude-context-guard');
    console.log('  ou      : npm link  (depuis le dossier du projet)\n');
  }

  const settings = loadSettings();

  if (isInstalled(settings)) {
    console.log('\x1b[32m✓ context-guard est déjà installé.\x1b[0m');
    return;
  }

  if (!isInstalled(settings)) {
    if (!settings.hooks) settings.hooks = {};
    if (!settings.hooks.PostToolUse) settings.hooks.PostToolUse = [];
    settings.hooks.PostToolUse.push(HOOK_ENTRY);
    console.log('\x1b[32m✓ Hook PostToolUse installé\x1b[0m');
  } else {
    console.log('\x1b[32m✓ Hook PostToolUse déjà présent\x1b[0m');
  }

  if (!hasStatusLine(settings)) {
    settings.statusLine = STATUSLINE_CONFIG;
    console.log('\x1b[32m✓ Status line installée\x1b[0m');
  } else {
    console.log('\x1b[32m✓ Status line déjà présente\x1b[0m');
  }

  saveSettings(settings);

  const threshold = parseInt(process.env.CONTEXT_GUARD_THRESHOLD || '40', 10);
  console.log(`  Barre visible en permanence | Alerte à ${threshold}% | Critique à 70%`);
  console.log('  Retirer : context-guard uninstall');
}

export async function uninstall() {
  const settings = loadSettings();

  if (!isInstalled(settings)) {
    console.log('context-guard n\'est pas installé.');
    return;
  }

  if (isInstalled(settings)) {
    settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
      e => !e.hooks?.some(h => h.command?.includes('context-guard'))
    );
    if (!settings.hooks.PostToolUse.length) delete settings.hooks.PostToolUse;
    if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks;
  }

  if (hasStatusLine(settings)) {
    delete settings.statusLine;
  }

  saveSettings(settings);
  console.log('\x1b[32m✓ Hook et status line retirés de ~/.claude/settings.json\x1b[0m');
}
