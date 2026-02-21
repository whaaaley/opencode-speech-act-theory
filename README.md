# Instruction Rule Formatter (IRF)

An OpenCode plugin that converts unstructured instruction text into structured, consistent rules using speech act theory and deontic logic.

## Overview

IRF takes raw instruction files and processes them through a two-step AI pipeline:

1. **Parse** — Converts raw text into structured rule components (strength, action, target, context, reason)
2. **Format** — Converts structured rules back into clean, human-readable `Rule: / Reason:` pairs

This process helps standardize instruction formats, reduce verbosity, and create consistent rule-based content.

## Installation

Add IRF as a global OpenCode plugin:

```ts
// ~/.config/opencode/plugins/irf.ts
export { IRFPlugin } from '/path/to/irf/src/index.ts'
```

## Usage

Once installed, the `irf-rewrite` tool is available in any OpenCode session. It reads the `instructions` array from your project's `opencode.json` and processes each matched file:

```json
{
  "instructions": ["docs/*.md", "rules/*.md"]
}
```

Call the tool directly or via a custom command:

```
/irf
```

## Theoretical Foundation

IRF is inspired by **speech act theory** and **deontic logic** to analyze and structure instructions.

### Speech Act Theory

Instructions contain performative utterances that create obligations, permissions, and prohibitions. IRF identifies the illocutionary force of each instruction by extracting:

- **Action verbs** (use, avoid, ensure, require)
- **Target objects** (what the action applies to)
- **Contextual conditions** (when/where the rule applies)
- **Justifications** (why the rule exists)

### Deontic Logic

IRF categorizes rules using deontic strength categories:

- **Obligatory** — Required actions that create strong obligations
- **Forbidden** — Prohibited actions with clear boundaries
- **Permissible** — Allowed actions within acceptable bounds
- **Optional** — Discretionary choices left to the actor
- **Supererogatory** — Actions that exceed normal expectations
- **Indifferent** — Actions with no normative preference
- **Omissible** — Actions that can be reasonably omitted

## Rule Schema

```ts
type ParsedRule = {
  strength: 'obligatory' | 'forbidden' | 'permissible' | 'optional' | 'supererogatory' | 'indifferent' | 'omissible'
  action: string
  target: string
  context?: string
  reason: string
}
```

### Example Transformation

**Input:**
```
Always use return await when returning promises from async functions. This provides better stack traces and error handling.
```

**Parsed:**
```json
{
  "strength": "obligatory",
  "action": "use",
  "target": "return await",
  "context": "when returning promises from async functions",
  "reason": "better stack traces and error handling"
}
```

**Output:**
```
Rule: Use return await when returning promises from async functions.
Reason: Better stack traces and error handling.
```

## Project Structure

```
src/
  index.ts         — Plugin entry, tool registration, orchestration
  session.ts       — Model detection, LLM prompting with retry
  discover.ts      — Reads opencode.json, resolves globs, reads files
  schema.ts        — Zod schemas for parsed rules and responses
  prompt.ts        — Prompt builders for parse, format, and retry
  compare.ts       — Byte size comparison and table formatting
  utils/
    safe.ts        — safe() and safeAsync() error wrappers
    validate.ts    — JSON parsing and Zod schema validation
    stripCodeFences.ts  — Strips markdown code fences from LLM output
    extractLlmError.ts  — Extracts error messages from SDK responses
```

## Development

```bash
deno test --allow-read --allow-env --allow-write
```

## License

MIT
