# Installation and updates

WolfMarkDown requires **Node.js 20 or newer**.

## Recommended installation

Install the canonical `wolfmarkdown` Agent Skill with the Skills CLI:

```bash
npx skills add WolfMarkTools/WolfMarkDown --skill wolfmarkdown
```

Reload the agent host after installation if the skill is not visible immediately.

For Claude Code, install globally for that host:

```bash
npx skills add WolfMarkTools/WolfMarkDown \
  --skill wolfmarkdown \
  -g \
  -a claude-code \
  -y
```

## Repository checkout

Use a checkout when developing WolfMarkDown or when the skill should track a local clone:

```bash
git clone https://github.com/WolfMarkTools/WolfMarkDown.git
cd WolfMarkDown
npm ci --prefix wolfmarkdown
node wolfmarkdown/scripts/install.mjs
```

The installer creates or verifies the shared `~/.agents/skills/wolfmarkdown` discovery link and the optional Claude Code compatibility link at `~/.claude/skills/wolfmarkdown`. It uses a directory junction on Windows when appropriate and refuses to overwrite unrelated paths. Setup is idempotent; a healthy runtime is not reinstalled unnecessarily.

## Doctor

After installation or an update, ask the agent:

```text
WolfMarkDown doctor
```

From a checkout, the equivalent direct command is:

```bash
node wolfmarkdown/scripts/doctor.mjs
```

Doctor reports runtime health and discovery health separately. Project-local Clean, Compose, and Verify can proceed when the runtime is healthy even if a global discovery link needs attention.

## Updating a Skills CLI installation

Update the installed skill with:

```bash
npx skills update wolfmarkdown
```

Use `-g` for global skills, `-p` for project skills, or `-y` to accept the CLI's detected scope without a prompt:

```bash
npx skills update wolfmarkdown -g
npx skills update wolfmarkdown -p
npx skills update -y
```

Reload the host after a successful update so it picks up the new `SKILL.md`.

## Updating a repository checkout

```bash
git pull
npm ci --prefix wolfmarkdown
node wolfmarkdown/scripts/install.mjs
```

`npm ci` synchronises the pinned runtime dependencies. `install.mjs` re-establishes discovery links and repairs dependencies only when they are missing or the wrong version.

## Compatibility

WolfMarkDown uses the Agent Skills directory convention. The following reflects the repository's current v1.0.0 acceptance metadata:

| Host | Discovery path | Repository status |
| --- | --- | --- |
| Codex, Cursor, Grok Build | Shared `.agents/skills` | Tested |
| Claude Code | Optional `.claude/skills` compatibility link | Tested |
| OpenCode, Gemini CLI, Antigravity, GitHub Copilot | Host-specific Agent Skills support | Pending |

This is a discovery and host-acceptance summary, not a promise that every host or model produces identical semantic decisions.
