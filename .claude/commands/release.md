# Release Skill

Automate the full release flow: pre-flight checks → version bump → commit → tag → push → trigger CI build & GitHub Release.

## Input

The user may provide:

- **Version bump type**: `patch`, `minor`, or `major` (e.g., `/release patch`)
- **Explicit version**: a semver string (e.g., `/release 0.2.0`)
- If no argument is given, ask the user which bump type they want using AskUserQuestion.

Use `$ARGUMENTS` to read the user's input.

## Steps

### 1. Pre-flight Checks

Run these checks and **stop with a clear error** if any fail:

1. **Clean working tree**: Run `git status --porcelain`. If there are uncommitted changes, warn the user and ask whether to proceed (the version bump commit will only include `apps/agentx/package.json`). Untracked files are OK to ignore.
2. **On main branch**: Run `git branch --show-current`. If not on `main`, warn and ask if they want to continue anyway.
3. **Synced with remote**: Run `git fetch origin main && git diff origin/main..HEAD --stat`. If there are unpushed commits, inform the user and ask whether to push them first or include them in this release.
4. **Build checks**: Run `pnpm lint && pnpm type-check && pnpm build` from the repo root. If any fail, stop and show the errors.

### 2. Determine New Version

- Read the current version from `apps/agentx/package.json` (the `"version"` field).
- Based on the bump type or explicit version from the user, calculate the new version.
  - `patch`: 0.1.0 → 0.1.1
  - `minor`: 0.1.0 → 0.2.0
  - `major`: 0.1.0 → 1.0.0
  - Explicit: use as-is (validate it's valid semver and greater than current)
- Show the user: `Release: v{current} → v{new}` and confirm before proceeding.

### 3. Bump Version

- Edit `apps/agentx/package.json` to update the `"version"` field to the new version.
- Do NOT bump versions in other `packages/*/package.json` (they are private internal packages at v0.0.0).

### 4. Commit & Tag

- Stage only the version file: `git add apps/agentx/package.json`
- Create a commit with message: `chore(release): v{new version}`
  - Do NOT add Co-Authored-By to release commits.
- Create an annotated tag: `git tag -a v{new version} -m "Release v{new version}"`

### 5. Push to Remote

- Push the commit and tag together: `git push origin main --follow-tags`
- This will trigger the existing GitHub Actions `release.yml` workflow which builds for macOS/Windows/Linux and creates a GitHub Release.

### 6. Post-Release

- Show the user a summary:
  - New version: `v{new version}`
  - Tag: `v{new version}`
  - GitHub Actions release URL: `https://github.com/{owner}/{repo}/actions` (derive from `git remote get-url origin`)
  - Remind them the CI will build multi-platform artifacts (DMG, EXE, AppImage) and create a GitHub Release automatically.

## Error Handling

- If any pre-flight check fails, show the error clearly and stop. Do not proceed with partial releases.
- If the git push fails, inform the user the tag was created locally and they can retry with `git push origin main --follow-tags`.
- If the user cancels at any confirmation step, cleanly abort without leaving partial state (undo version bump edit if needed).

## Important Notes

- This project uses conventional commits enforced by commitlint (`@commitlint/config-conventional`). Use `chore(release):` as the commit type.
- The release workflow is already configured in `.github/workflows/release.yml` — do NOT modify it.
- Skip tests (`pnpm test`) in the build checks since the test suite may not be fully set up yet. Only run lint, type-check, and build.
