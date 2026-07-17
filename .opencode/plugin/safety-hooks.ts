import type { Plugin } from "@opencode-ai/plugin"

/**
 * safety-hooks plugin
 *
 * Provides three safety hooks for the social-autopoiesis-sandbox workspace:
 *  1. bash safety     — block dangerous bash commands (rm -rf /, force push to main)
 *  2. edit pre-check  — log impact-analysis hint before edits to shared modules
 *  3. commit guard    — nudge to run verify.sh before git commit
 *
 * These hooks are advisory; hard enforcement is done via `permission` in
 * opencode.json. The plugin complements those rules with contextual messages.
 */

const DANGEROUS_BASH = [
  /\brm\s+-rf?\s+\/(\s|$)/,
  /\bgit\s+push\b.*\b--force\b.*\b(main|master)\b/,
  /\bgit\s+push\b.*\b--no-verify\b/,
  /\bdd\b.*\bof=\/dev\/(sd|nvme|hd)/,
  /\b:\(\)\s*\{.*\|.*&\s*\};/, // fork bomb
]

const SHARED_PATHS = [
  /\/shared\//,
  /\/models\//,
  /\/schemas\//,
  /\/__init__\.py$/,
  /\/pyproject\.toml$/,
  /\/docker-compose\.ya?ml$/,
]

const plugin: Plugin = async () => {
  return {
    // 1 + 3. Bash safety + commit guard (single handler, key is unique)
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return
      const cmd: string = output.args?.command ?? ""
      if (!cmd) return

      // Block dangerous commands
      for (const pattern of DANGEROUS_BASH) {
        if (pattern.test(cmd)) {
          output.args.command = `echo "[safety-hooks] BLOCKED dangerous command" && false`
          return
        }
      }

      // Warn on deploy-adjacent commands
      if (/\b(prod|production|deploy)\b/i.test(cmd)) {
        output.args.command = `echo "[safety-hooks] ⚠️  Deploy/prod command detected — confirm with user." && ${cmd}`
        return
      }

      // Commit guard — remind that verify.sh will run via git hook
      if (/\bgit\s+commit\b/.test(cmd) && !/\b--no-verify\b/.test(cmd)) {
        output.args.command =
          `echo "[safety-hooks] 💡 Pre-commit: verify.sh will run via git hook." && ${cmd}`
      }
    },

    // 2. Edit pre-check — annotate edits to shared modules with impact reminder
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "edit") return
      const path: string = input.args?.filePath ?? output.metadata?.filePath ?? ""
      if (!path) return
      for (const pattern of SHARED_PATHS) {
        if (pattern.test(path)) {
          output.output =
            `[safety-hooks] ℹ️  Edited a shared/critical path: ${path}\n` +
            `Consider running the impact-analysis skill or /review before committing.\n` +
            output.output
          break
        }
      }
    },
  }
}

export default plugin