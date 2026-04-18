# Cely

**Cely** (like CLI ⚡) — a desktop app for managing multiple AI coding agents. Run Claude Code + Cursor side by side, collaborate between agents, and ship faster.

Built with Electron, React, and the Claude Agent SDK.

## Features

- **Multi-session terminals** — Run multiple Claude Code sessions simultaneously
- **Model switching** — Switch between Opus 4.6, Sonnet 4.6, and Haiku 4.5
- **Git integration** — View changed files and side-by-side diffs
- **Session persistence** — Chat sessions are saved locally with SQLite
- **Command palette** — Quick access to actions with Cmd+K
- **Keyboard shortcuts** — Cmd+N (new chat), Cmd+W (close), Cmd+1-9 (switch)

## Prerequisites

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

If `claude` works in your terminal, you're good to go. No extra API keys needed.

## Setup

```bash
# Install dependencies
npm install

# Run in development mode (with hot-reload)
npm run dev
```

## Build as Desktop App

```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

The packaged app will be in the `dist/` folder. On macOS, drag the `.app` to your Applications folder to use it as a clickable desktop app.

## Tech Stack

- **Electron** — Desktop app framework
- **React** — UI framework
- **Tailwind CSS v4** — Styling
- **xterm.js** — Terminal emulator
- **better-sqlite3** — Local session storage
- **zustand** — State management
- **Claude Agent SDK** — AI integration

## License

MIT
