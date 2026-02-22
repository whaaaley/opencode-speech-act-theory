# OpenCode SAT (Speech Act Theory)

An OpenCode plugin that converts unstructured text into structured, consistent formats using speech act theory.

<img width="612" height="256" alt="Rule formatting table output" src="https://github.com/user-attachments/assets/51edf4b5-831a-4e13-96de-8cad453ea13e" />

## Quick Start

Add the plugin to your `opencode.json` and restart OpenCode:

```json
{
  "plugin": ["opencode-sat"]
}
```

Then just tell OpenCode what you want:

```
Rewrite my instruction files
Add a rule about using early returns
```

Messy or voice-transcribed input can be restructured into a clear task hierarchy using the prompt tools.

## Tools

For the theory behind the plugin, see [Theoretical Foundation](#theoretical-foundation).

The plugin provides 7 tools organized into two pipelines.

### Rules Pipeline

Discovers, parses, formats, and writes instruction rules. The LLM drives each step.

```
discover-rules -> parse-rules -> format-rules -> rewrite-rules
                                               -> add-rules
```

#### discover-rules

Reads instruction files from your `opencode.json` configuration. Accepts an optional `files` string of comma-separated paths to read specific files instead of running discovery.

#### parse-rules

Parses instruction file content or unstructured user input into structured rules JSON. Validates the parsed rules against the schema and returns validated JSON. Call after `discover-rules` and before `format-rules`.

#### format-rules

Converts parsed rules into human-readable formatted rule strings. Accepts an optional `mode` (`verbose`, `balanced`, or `concise`, default `balanced`). Validates the formatted rules and returns validated JSON. Call after `parse-rules` and before `rewrite-rules` or `add-rules`.

#### rewrite-rules

Writes formatted rule strings to instruction files, replacing existing content. Accepts an optional `mode` and an optional `files` string of comma-separated paths. Call after `format-rules`.

#### add-rules

Appends formatted rule strings to an instruction file without rewriting existing content. Accepts an optional `mode` and an optional `file` path (defaults to the first discovered instruction file). Call after `format-rules`.

### Formatting Modes

```
rewrite-rules [mode=concise]
rewrite-rules [files=a.md,b.md, mode=verbose]
add-rules [mode=concise]
```

**Input:**
```
Always use return await when returning promises from async functions. This provides
better stack traces and error handling. Arrow functions are the standard function
syntax. Do not use function declarations or function expressions because arrow
functions provide lexical this binding and a more compact syntax.
```

**verbose** - Full Rule/Reason pairs for every rule.
```
Rule: Use return await when returning promises from async functions.
Reason: Provides better stack traces and error handling.

Rule: Use arrow functions as the standard function syntax.
Reason: Arrow functions provide lexical this binding and a more compact syntax.

Rule: Do not use function declarations or function expressions.
Reason: Arrow functions are the standard syntax for the project.
```

**balanced** (default) - The LLM decides which rules need reasons.
```
Rule: Use return await when returning promises from async functions.
Reason: Provides better stack traces and error handling.

Rule: Use arrow functions as the standard function syntax.

Rule: Do not use function declarations or function expressions.
Reason: Arrow functions provide lexical this binding and a more compact syntax.
```

**concise** - Bullet list of directives only, no reasons.
```
- Use return await when returning promises from async functions.
- Use arrow functions as the standard function syntax.
- Do not use function declarations or function expressions.
```

### Prompt Pipeline

Restructures messy or unstructured user input into a clear task hierarchy.

```
parse-prompt -> format-prompt
```

#### parse-prompt

Decomposes raw text (often from voice transcription) into structured tasks with intent, targets, constraints, context, and recursive subtasks. Validates against the schema and returns validated JSON.

#### format-prompt

Renders validated tasks from `parse-prompt` into a formatted markdown tree view.

```
parse-prompt [input=refactor the search module add guards to each provider make sure bsky and wiki get validated then run the tests]
```

Output:
```
┌ 1. Refactor the search module
│    > Targets: src/search.ts, src/providers/
│    > Constraints: use safeAsync, no optional chaining
│    > Context: Current error handling is inconsistent
│
├──┬ 2. Add guards to providers
│  │    > Targets: src/providers/
│  │    > Constraints: use isRecord helper
│  │
│  ├─── 3. Validate bsky responses
│  │       > Targets: bsky-search.ts
│  │
│  └─── 4. Validate wiki responses
│          > Targets: wiki-search.ts
│
├─── 5. Update error handling
│       > Targets: src/utils/safe.ts
│
└─── 6. Run the tests
        > Constraints: fix any failures
```

## Theoretical Foundation

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

The `strength` field maps to deontic operators. The critical relationship is F(A) = O(not-A): a forbidden action must be negated in expression.

| Strength | Operator | Expression |
|---|---|---|
| obligatory | O(A) | positive imperative: "use consistent whitespace" |
| forbidden | F(A) = O(not-A) | negate with "do not": "do not use non-null assertions" |
| permissible | P(A) | prefix with "may": "may use type assertions when necessary" |
| optional | P(A) and P(not-A) | prefix with "may choose to": "may choose to add commit body" |
| supererogatory | beyond O(A) | prefix with "ideally": "ideally provide comprehensive documentation" |
| indifferent | P(A) and P(not-A) | prefix with "either way is fine": "either way is fine for naming style" |
| omissible | P(not-A) | prefix with "may omit": "may omit post-task explanations" |

### Prompt Formatting (action/planning logic, performative directives)

Prompts request a specific one-shot action. They are not standing rules but immediate instructions. The formal framework is closer to [action languages](https://en.wikipedia.org/wiki/Action_language) from AI planning (STRIPS, ADL, HTN): what the goal is, what must be true before acting, and what changes after.

A messy user prompt typically mixes three levels together:

- **Goal** (desired end state): "I want search results to show up in chat"
- **Tasks** (what to do): "add a postResult call, update the providers"
- **Constraints** (conditions/preferences): "don't break existing tests, use safeAsync"

The plugin parses raw input into structured components:

```ts
type ParsedTask = {
  intent: string
  targets: Array<string>
  constraints: Array<string>
  context?: string
  subtasks: Array<ParsedTask>
}
```

The schema is recursive. A `ParsedTask` can contain subtasks, which can contain their own subtasks. This follows the HTN (Hierarchical Task Network) model where compound tasks decompose into subtask trees.

## Disclaimer

I'm not an NLP expert. I stumbled onto speech act theory and deontic logic while researching NLP and thought it could be a good fit for structuring instructions. The implementation may not perfectly align with academic definitions, but the goal is practical utility.

## License

MIT
