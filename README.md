# claude-context-guard

Monitor your Claude Code context window usage. Get a visual alert when usage exceeds a configurable threshold (default: 40%).

```
────────────────────────────────────────────
  ALERTE CONTEXTE — 42%
  ████████████░░░░░░░░░░░░░░░░░░  84K/200K
  → Pensez à /compact
────────────────────────────────────────────
```

## Install

```bash
npm install -g claude-context-guard
context-guard install
```

Or directly from GitHub:

```bash
npm install -g github:YOUR_USERNAME/claude-context-guard
context-guard install
```

## How it works

A `PostToolUse` hook is added to `~/.claude/settings.json`. After every tool call, the hook:

1. Estimates token consumption from tool inputs/outputs
2. Applies an overhead multiplier for system prompts and messages
3. Alerts (terminal + Claude) when the threshold is crossed

Two alert levels:
- **Warning** (yellow) at 40% — suggests `/compact`
- **Critical** (red) at 70% — urges immediate `/compact`

Alerts fire once per level per session. Claude sees the alert via `exit 2` and can act on it.

## Commands

| Command | Description |
|---------|-------------|
| `context-guard install` | Add hook to Claude Code settings |
| `context-guard uninstall` | Remove hook from Claude Code settings |
| `context-guard status` | Show current session context usage |
| `context-guard reset` | Clear all session tracking data |

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `CONTEXT_GUARD_THRESHOLD` | `40` | Alert threshold (%) |
| `CONTEXT_GUARD_WINDOW` | `200000` | Context window size (tokens) |

## Uninstall

```bash
context-guard uninstall
npm uninstall -g claude-context-guard
```

## License

MIT
