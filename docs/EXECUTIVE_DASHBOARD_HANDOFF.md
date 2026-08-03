# Executive Dashboard handoff

## Scope

- Adds the protected `/fabrika/akilli-panel` design as an immersive alternative to the classic command center.
- Keeps the existing Fabrika session provider and authorization boundary.
- Adds the agreed dual-entry workflow: AI Portföy Uzmanı or AI Stüdyo → Portföyler → optional AI Reklam Tasarımı → AI Pazarlama Uzmanı → results.
- Adds a compact dialog workflow with autosave, per-image state, retry, review, cover selection, removal/original restore, marketing selections and a consolidated results screen.
- Reuses the existing General Manager chat endpoint from the new right-hand command area.
- Uses the current Studio batch API for background image processing, polling, completion notifications and one-click retry.
- Creates a real draft portfolio through the current Workspace API, attaches approved Studio results and persists the selected cover photo.
- Uses the current SEO generator for AI-assisted title and description completion.

## Merge boundary

This branch does not modify Studio pages, Studio API routes, database schema, package manifests, or deployment configuration. It only changes the classic Fabrika page and app shell, and adds isolated dashboard/workflow files that consume existing APIs.

## Verification

- Full Vitest suite
- TypeScript and Next route type generation
- Targeted ESLint
- Next production build with Webpack (the worktree shares `node_modules`; Turbopack rejects that external symlink)
- Desktop and 390×844 responsive browser checks
