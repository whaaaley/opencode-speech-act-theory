# Instruction Rule Formatter (IRF)

An OpenCode plugin that converts unstructured instruction text into structured, consistent rules using speech act theory and deontic logic.

## Disclaimer

I'm not an NLP expert. I did some research to learn a bit more theory on NLP and stumbled onto speech act theory and deontic logic and thought it could be a good fit for instructions.
I was annoyed trying to write consistent rules, thinking about phrasing and grammar, so I thought there might be a better way to approach this systematically.
This project is just me experimenting with these concepts to see if they can help structure and standardize instruction text.
The implementation may not perfectly align with academic definitions, but the goal is practical utility in organizing rule-based content.

## Overview

IRF takes raw instruction files and processes them through a two-step AI pipeline:

1. **Parse** — Converts raw text into structured rule components (strength, action, target, context, reason)
2. **Format** — Converts structured rules into one of three output modes

This process helps standardize instruction formats, reduce verbosity, and create consistent rule-based content.

### Format Modes

The `irf-rewrite` tool accepts a `mode` argument that controls output density:

- **verbose** — Full `Rule: / Reason:` pairs for every rule. Best for onboarding and documentation where understanding *why* matters.
- **balanced** (default) — The LLM decides which rules need reasons and which are self-explanatory. Keeps reasons for non-obvious rules, drops them for clear directives.
- **concise** — Bullet list of directives only, no reasons. Minimal token usage, best for LLM-consumed instruction files where compliance is the goal.

## Installation

Add IRF as a global OpenCode plugin:

```ts
// ~/.config/opencode/plugins/irf.ts
export { IRFPlugin } from '/path/to/irf/src/index.ts'
```

## Usage

Once installed, the `irf-rewrite` tool is available in any OpenCode session. By default it reads the `instructions` array from your project's `opencode.json` and processes each matched file:

```json
{
  "instructions": ["docs/*.md", "rules/*.md"]
}
```

To process specific files instead of running discovery, pass a `files` parameter:

```
irf-rewrite                              # discover from opencode.json, balanced mode
irf-rewrite --mode concise               # discover, concise output
irf-rewrite --files fixtures/testing.md  # single file, balanced mode
irf-rewrite --files a.md,b.md --mode verbose  # multiple files, verbose output
```

### Examples

**Input:**
```
Always use return await when returning promises from async functions. This provides
better stack traces and error handling. Arrow functions are the standard function
syntax. Do not use function declarations or function expressions because arrow
functions provide lexical this binding and a more compact syntax.
```

**verbose:**
```
Rule: Always use return await when returning promises from async functions.
Reason: Provides better stack traces and error handling.

Rule: Use arrow functions as the standard function syntax.
Reason: Arrow functions provide lexical this binding and a more compact syntax.

Rule: Never use function declarations or function expressions.
Reason: Arrow functions are the standard syntax for the project.
```

**balanced:**
```
Rule: Always use return await when returning promises from async functions.
Reason: Provides better stack traces and error handling.

Rule: Use arrow functions as the standard function syntax.

Rule: Never use function declarations or function expressions.
Reason: Arrow functions provide lexical this binding and a more compact syntax.
```

**concise:**
```
- Always use return await when returning promises from async functions.
- Use arrow functions as the standard function syntax.
- Never use function declarations or function expressions.
```

## Theoretical Foundation

IRF is inspired by **[speech act theory](https://en.wikipedia.org/wiki/Speech_act)** and **[deontic logic](https://en.wikipedia.org/wiki/Deontic_logic)** to analyze and structure instructions.

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
  process.ts       — Per-file parse/format/write pipeline
  session.ts       — Model detection, LLM prompting with retry
  discover.ts      — Reads opencode.json, resolves globs, reads files
  schema.ts        — Zod schemas for parsed rules and responses
  prompt.ts        — Prompt builders for parse, format, and retry
  utils/
    compare.ts     — Byte size comparison and table formatting
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
