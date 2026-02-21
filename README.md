# Instruction Rule Formatter (IRF)

An OpenCode plugin that converts unstructured instruction text into structured, consistent rules using speech act theory and deontic logic.

## Quick Start

Once installed, just tell OpenCode what you want:

```
Use IRF to rewrite my instruction files
Rewrite instructions.md with IRF in verbose mode
Use IRF to reformat docs/rules.md, concise
```

## Overview

IRF takes raw instruction files and processes them through a two-step AI pipeline:

1. **Parse** - Converts raw text into structured rule components (strength, action, target, context, reason)
2. **Format** - Converts structured rules into one of three output modes: verbose, balanced, or concise

### Example

**Input:**
```
Always use return await when returning promises from async functions. This provides
better stack traces and error handling. Arrow functions are the standard function
syntax. Do not use function declarations or function expressions because arrow
functions provide lexical this binding and a more compact syntax.
```

**verbose** - Full Rule/Reason pairs for every rule.
```
Rule: Always use return await when returning promises from async functions.
Reason: Provides better stack traces and error handling.

Rule: Use arrow functions as the standard function syntax.
Reason: Arrow functions provide lexical this binding and a more compact syntax.

Rule: Never use function declarations or function expressions.
Reason: Arrow functions are the standard syntax for the project.
```

**balanced** (default) - The LLM decides which rules need reasons.
```
Rule: Always use return await when returning promises from async functions.
Reason: Provides better stack traces and error handling.

Rule: Use arrow functions as the standard function syntax.

Rule: Never use function declarations or function expressions.
Reason: Arrow functions provide lexical this binding and a more compact syntax.
```

**concise** - Bullet list of directives only, no reasons.
```
- Always use return await when returning promises from async functions.
- Use arrow functions as the standard function syntax.
- Never use function declarations or function expressions.
```

## Installation

Add IRF to your `opencode.json`:

```json
{
  "plugin": ["opencode-irf"]
}
```

Restart OpenCode. The plugin will be installed automatically.

## Usage

The `irf-rewrite` tool reads the `instructions` array from your project's `opencode.json` and processes each matched file:

```json
{
  "instructions": ["docs/*.md", "rules/*.md"]
}
```

```
irf-rewrite                                    # discover from opencode.json, balanced mode
irf-rewrite --mode concise                     # discover, concise output
irf-rewrite --files fixtures/testing.md        # single file, balanced mode
irf-rewrite --files a.md,b.md --mode verbose   # multiple files, verbose output
```

## Theoretical Foundation

IRF is grounded in [speech act theory](https://en.wikipedia.org/wiki/Speech_act) and [deontic logic](https://en.wikipedia.org/wiki/Deontic_logic).

Instructions contain performative utterances that create obligations, permissions, and prohibitions. IRF identifies the illocutionary force of each instruction by extracting action verbs, target objects, contextual conditions, and justifications.

Rules are categorized using deontic strength:

- **Obligatory** - Required actions that create strong obligations
- **Forbidden** - Prohibited actions with clear boundaries
- **Permissible** - Allowed actions within acceptable bounds
- **Optional** - Discretionary choices left to the actor
- **Supererogatory** - Actions that exceed normal expectations
- **Indifferent** - Actions with no normative preference
- **Omissible** - Actions that can be reasonably omitted

### Rule Schema

```ts
type ParsedRule = {
  strength: 'obligatory' | 'forbidden' | 'permissible' | 'optional' | 'supererogatory' | 'indifferent' | 'omissible'
  action: string
  target: string
  context?: string
  reason: string
}
```

### Parsed Example

```
Always use return await when returning promises from async functions.
This provides better stack traces and error handling.
```

```json
{
  "strength": "obligatory",
  "action": "use",
  "target": "return await",
  "context": "when returning promises from async functions",
  "reason": "better stack traces and error handling"
}
```

## Disclaimer

I'm not an NLP expert. I stumbled onto speech act theory and deontic logic while researching NLP and thought it could be a good fit for structuring instructions. I was annoyed trying to write consistent rules, thinking about phrasing and grammar, so I thought there might be a better way to approach this systematically. The implementation may not perfectly align with academic definitions, but the goal is practical utility.

## License

MIT
