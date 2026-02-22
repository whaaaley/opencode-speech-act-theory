# OpenCode SAT - Speech Act Theory

An OpenCode plugin that converts unstructured text into structured, consistent formats using speech act theory.

<img width="612" height="256" alt="image" src="https://github.com/user-attachments/assets/51edf4b5-831a-4e13-96de-8cad453ea13e" />
<img width="478" height="607" alt="image" src="https://github.com/user-attachments/assets/a92d44b8-5d63-4ddb-ad95-f1614cc9b110" />

## Quick Start

Once installed, just tell OpenCode what you want:

```
Rewrite my instruction files
Rewrite instructions.md in verbose mode
Add a rule about using early returns
```

Messy or voice-transcribed input is automatically refined into structured tasks before the agent acts on it.

## Two Formatters

The plugin is built on [speech act theory](https://en.wikipedia.org/wiki/Speech_act) (Austin, Searle). All instructions are **directives**: speech acts that get the hearer to do something. But directives come in two forms, and each needs a different formal framework.

### Rule Formatting (deontic logic, regulative directives)

Rules constrain ongoing behavior. They are standing obligations, prohibitions, and permissions that persist across all future actions. The formal framework is [deontic logic](https://en.wikipedia.org/wiki/Deontic_logic): what is obligatory, forbidden, and permissible.

The plugin parses unstructured rule text into structured components:

```ts
type ParsedRule = {
  strength: 'obligatory' | 'forbidden' | 'permissible' | 'optional' | 'supererogatory' | 'indifferent' | 'omissible'
  action: string
  target: string
  context?: string
  reason: string
}
```

Then formats them into one of three output modes: verbose, balanced, or concise.

**Status: implemented.** See [Usage](#usage) below.

### Prompt Formatting (action/planning logic, performative directives)

Prompts request a specific one-shot action. They are not standing rules but immediate instructions. The formal framework is closer to [action languages](https://en.wikipedia.org/wiki/Action_language) from AI planning (STRIPS, ADL, HTN): what the goal is, what must be true before acting, and what changes after.

A messy user prompt typically mixes three levels together:

- **Goal** (desired end state): "I want search results to show up in chat"
- **Tasks** (what to do): "add a postResult call, update the providers"
- **Constraints** (conditions/preferences): "don't break existing tests, use safeAsync"

Prompt formatting would parse raw input into structured components like:

```ts
type ParsedTask = {
  intent: string
  targets: Array<string>
  constraints: Array<string>
  context?: string
  subtasks: Array<ParsedTask>
}

type ParsedPrompt = {
  tasks: Array<ParsedTask>
}
```

The schema is recursive. A `ParsedTask` can contain subtasks, which can contain their own subtasks. This follows the HTN (Hierarchical Task Network) model where compound tasks decompose into subtask trees. A voice dump like "refactor the search module, add guards to each provider, make sure bsky and wiki get validated, then run the tests and fix anything that breaks" becomes:

```
tasks:
  - intent: refactor the search module
    subtasks:
      - intent: add guards to each provider
        subtasks:
          - intent: validate bsky responses
          - intent: validate wiki responses
  - intent: run the tests
    subtasks:
      - intent: fix any failures
```

This is especially useful for voice input, where thoughts are unstructured, sentences run together, and a single utterance often contains an entire task tree.

**Status: implemented.** See [refine-prompt](#refine-prompt) below.

## Overview

The plugin takes raw instruction files and processes them through a two-step AI pipeline:

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

Add `opencode-sat` to your `opencode.json`:

```json
{
  "plugin": ["opencode-sat"]
}
```

Restart OpenCode. The plugin will be installed automatically.

## Usage

The `rewrite-instructions` tool reads the `instructions` array from your project's `opencode.json` and processes each matched file:

```json
{
  "instructions": ["docs/*.md", "rules/*.md"]
}
```

### rewrite-instructions

Rewrites all matched instruction files through the parse/format pipeline.

```
rewrite-instructions                                    # discover from opencode.json, balanced mode
rewrite-instructions --mode concise                     # discover, concise output
rewrite-instructions --files fixtures/testing.md        # single file, balanced mode
rewrite-instructions --files a.md,b.md --mode verbose   # multiple files, verbose output
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `mode` | string | No | Output format: verbose, balanced, or concise (default: balanced) |
| `files` | string | No | Comma-separated file paths to process instead of discovering from opencode.json |

### add-instruction

Appends new rules to the end of an instruction file without rewriting existing content.

```
add-instruction --input "Always use early returns"     # append to first discovered file, balanced mode
add-instruction --input "Use early returns" --mode concise
add-instruction --input "Use early returns" --file docs/rules.md
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `input` | string | Yes | Unstructured rule text to parse, format, and append |
| `file` | string | No | Target file path (default: first discovered instruction file) |
| `mode` | string | No | Output format: verbose, balanced, or concise (default: balanced) |

### automatic-rule

Automatically detects when the user corrects the agent's behavior or expresses a coding preference, extracts the implicit rule, and appends it to the instruction file. This tool is invoked automatically by the LLM, not by the user.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `input` | string | Yes | The user's correction or feedback to extract a rule from |
| `file` | string | No | Target file path (default: first discovered instruction file) |

### refine-prompt

Restructures messy or unstructured user input into a clear, actionable task hierarchy. Takes raw text (often from voice transcription) and decomposes it into structured tasks with intent, targets, constraints, context, and recursive subtasks. Returns a formatted prompt the agent can act on.

```
refine-prompt --input "refactor the search module add guards to each provider make sure bsky and wiki get validated then run the tests and fix anything that breaks"
```

Output:
```
1. Refactor the search module
   Targets: src/search.ts
   - Add guards to each provider
     Targets: src/providers/
     - Validate bsky responses
       Targets: bsky-search.ts
     - Validate wiki responses
       Targets: wiki-search.ts

2. Run the tests
   Constraints: fix any failures
```

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `input` | string | Yes | Raw unstructured user input to restructure |

## Theoretical Foundation

The plugin is grounded in [speech act theory](https://en.wikipedia.org/wiki/Speech_act) and [deontic logic](https://en.wikipedia.org/wiki/Deontic_logic).

Instructions contain performative utterances that create obligations, permissions, and prohibitions. The plugin identifies the illocutionary force of each instruction by extracting action verbs, target objects, contextual conditions, and justifications.

Deontic strengths:

- **Obligatory** - Required actions that create strong obligations
- **Forbidden** - Prohibited actions with clear boundaries
- **Permissible** - Allowed actions within acceptable bounds
- **Optional** - Discretionary choices left to the actor
- **Supererogatory** - Actions that exceed normal expectations
- **Indifferent** - Actions with no normative preference
- **Omissible** - Actions that can be reasonably omitted

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
