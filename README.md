# social-autopoiesis-sandbox
A multi-agent simulation sandbox mimicking Niklas Luhmann's Social Systems Theory (Autopoiesis). Built with Python and Docker, supporting multiple LLM providers (Ollama, Gemini, OpenAI) to simulate autonomous communication loops driven by functional system binary codes.

## AI Agent Setup
This repository ships with a shared multi-agent harness (`.shared-agents/`)
usable from OpenCode, Claude Code, Gemini, and Antigravity.

```bash
./.shared-agents/harness/setup.sh
```

This creates symlinks into `.opencode/`, `.claude/`, `.agents/`, and
`.antigravitycli/`, and installs 12 slash commands (`/goal`, `/review`, `/prd`,
`/spec`, `/verify`, `/architect`, `/qa`, `/status`, `/infra`, `/plan`,
`/clean`, `/commit`) globally for OpenCode — so they work from **any**
repository.

See [AGENTS.md](AGENTS.md) and [GEMINI.md](GEMINI.md) for coding mandates.
