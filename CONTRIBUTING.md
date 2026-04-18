# Contributing

Thanks for your interest in contributing to Cely! Here's how to get started.

## Development Setup

1. Fork and clone the repo
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`

## Making Changes

1. Create a branch from `main`: `git checkout -b my-feature`
2. Make your changes
3. Run linting and type checks:
   ```bash
   npm run lint
   npm run typecheck
   ```
4. Test your changes locally with `npm run dev`
5. Commit with a clear, descriptive message
6. Open a pull request against `main`

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Include a description of what changed and why
- Add screenshots for UI changes
- Make sure linting and type checks pass

## Reporting Issues

- Use GitHub Issues to report bugs or request features
- Include steps to reproduce for bugs
- Include your OS, Node.js version, and Electron version

## Code Style

- TypeScript strict mode
- Prettier for formatting (`npm run format`)
- ESLint for linting (`npm run lint`)
- Tailwind CSS for styling — avoid custom CSS where possible
