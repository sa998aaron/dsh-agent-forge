# dsh-agent-forge

[中文](README.zh.md) | English

**Forge a solidifiable agent from any code workspace — progressively.**

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) host plugin that
turns an arbitrary code workspace into a persistent, installable agent (preset + guardrailed
plugin). It formalizes the path we walked by hand on a real firmware project: observe the
workspace, derive a persona, scaffold tools, derive guardrails, verify, then crystallize.

## The maturity ladder

| Level | Meaning | Tool |
|---|---|---|
| L0 | Observed: workspace profile report | `forge_scan` |
| L1 | Persona: installable preset | `forge_generate target=preset` |
| L2 | Tools: plugin skeleton with detected tool stubs | `forge_generate target=plugin` |
| L3 | Guardrails: edit rules from detected quirks | same (`guard.ts` rule table) |
| L4 | Verified: three-layer verification passed | `forge_status` + human confirmation |
| — | Crystallized: installed into the preset roster | `forge_install` |

## Tools

- `forge_scan(workspace)` — profile a workspace: languages, build systems (cmd/cmake/npm/make),
  Kconfig, large XML/ITU files, `.agents/skills`, protected-dir candidates (sdk/vendor/third_party),
  and the `.c #include .c` compilation-unit quirk.
- `forge_plan(workspace)` — report → forge plan (persona rules / tools / guardrails).
  Writes nothing; meant for human review first.
- `forge_generate(workspace, target)` — writes `.agents/dsh-<id>/{preset,plugin}/` in the
  workspace. Idempotent.
- `forge_install(workspace)` — crystallizes the preset into `~/.dsh/.agent-presets/<id>/` with
  sha256 manifests. **Files you edited are never overwritten** (materialization pattern borrowed
  from dsh-ptc-cordis-preset).
- `forge_status(workspace)` — current level + next step, derived from artifact existence
  (no state file, no drift).

## Mounting

Forge is a meta-tool; mount it into the web profile so every session can use it:

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- insert:
    - id: agent-forge
      name: 'file:///E:/ai/dsh-agent-forge/src/index.ts'
```

Host-side changes require a DSH restart (ESM module cache is process-level).

## Typical flow

```text
forge_scan('D:/some/project')          # L0: profile
forge_plan('D:/some/project')          # review the plan
forge_generate(..., 'preset')          # L1
forge_generate(..., 'plugin')          # L2/L3
cd .agents/dsh-<id>/plugin && pnpm i && pnpm test   # layer 1-2
forge_install(...)                     # crystallize; new sessions can select it
verify on a real session               # layer 3 (human)
```

## Testing

17 tests: layer 1 (pure functions: scan/plan/generate/materialize) + layer 2 (registration
contracts, JSON-Schema compilation). `generate.spec.ts` even **executes the generated
`define-tool.ts`** and asserts behavioral parity with the host copy.

```sh
pnpm install && pnpm test
```

## Design principles

- **All decisions are pure functions**; fs access lives only in `collectSnapshot` and tool `execute`.
- **No state file**: maturity derives from artifact existence — it cannot drift.
- **Conservative generation**: only evidence-backed entries are generated; quirk confirmation
  stays with the human.
- **Ecosystem position**: dsh-assembler assembles agents from a capability catalog (parts are
  ready-made MCP/tools); this plugin forges agents from a **code workspace** (the repo itself
  is the material).

## License

MIT
