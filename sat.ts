import type { Plugin } from '@opencode-ai/plugin'
import { DEONTIC_STRENGTHS, MODE_FORMATS, NEGATION_SIGNALS } from './src/tools/descriptions.ts'
import { createFormatPromptTool, createParsePromptTool } from './src/tools/prompts.ts'
import {
  createAddTool,
  createDiscoverTool,
  createFormatRulesTool,
  createParseRulesTool,
  createRewriteTool,
} from './src/tools/rules.ts'

const plugin: Plugin = async ({ directory, client }) => {
  const discovered = new Set<string>()

  return {
    tool: {
      'discover-rules': createDiscoverTool({
        directory,
        discovered,
        description: [
          '- Discover instruction files from opencode.json configuration.',
          '- Read discovered instruction files and return their paths and contents.',
          '- Optionally accept a files parameter to read specific files instead of running discovery.',
        ].join('\n'),
      }),

      'parse-rules': createParseRulesTool({
        description: [
          '- Parse instruction file content or unstructured user input into structured rules JSON.',
          '- The rules parameter is required and must be a JSON string matching the schema described in the parameter.',
          '- Validates the parsed rules against the schema and returns the validated JSON.',
          '- Call this tool AFTER discover-rules and BEFORE format-rules.',
          '',
          'Extract each rule into: strength, action (verb), target (object), context (optional condition), reason.',
          'Each parsed rule must correspond to the original instruction without adding extra details.',
          '',
          'Detect deontic strength from input signals:',
          NEGATION_SIGNALS,
          '',
          'Strength determines enforcement:',
          DEONTIC_STRENGTHS,
        ].join('\n'),
      }),

      'format-rules': createFormatRulesTool({
        description: [
          '- Convert parsed rules from parse-rules into human-readable formatted rule strings.',
          '- Express deontic strength naturally: obligatory as positive imperative, forbidden as negated imperative (do not), permissible as "may".',
          '- Optionally accept a mode parameter (verbose, balanced, or concise) to control formatting.',
          '- Default to balanced mode when no mode is specified.',
          '- The rules parameter is required and must be a JSON string matching the schema described in the parameter.',
          '- Validates the formatted rules and returns the validated JSON.',
          '- Call this tool AFTER parse-rules and BEFORE rewrite-rules or add-rules.',
          '',
          'Strength determines how the rule is expressed:',
          DEONTIC_STRENGTHS,
          '',
          'CRITICAL: forbidden + action "use" MUST produce "do not use ...", never "use ...".',
          '',
          'Output format per mode:',
          MODE_FORMATS,
          '',
          'For verbose and balanced modes, each rule string must include "Rule: " prefix and "\\nReason: " suffix.',
          'For concise mode, use "- " prefix with directive only, no reasons.',
        ].join('\n'),
      }),

      'rewrite-rules': createRewriteTool({
        client,
        directory,
        discovered,
        description: [
          '- Write formatted rule strings from format-rules to instruction files, replacing existing content.',
          '- The rules parameter is required and must be a JSON string matching the schema described in the parameter.',
          '- Optionally accept a mode parameter (verbose, balanced, or concise) to control formatting.',
          '- Default to balanced mode when no mode is specified.',
          '- Optionally accept a files parameter to process specific files instead of discovering from opencode.json.',
          '- Call this tool AFTER format-rules.',
        ].join('\n'),
      }),

      'add-rules': createAddTool({
        client,
        directory,
        discovered,
        description: [
          '- Append formatted rule strings from format-rules to an instruction file without rewriting existing content.',
          '- The rules parameter is required and must be a JSON string matching the schema described in the parameter.',
          '- Optionally accept a mode parameter (verbose, balanced, or concise) to control formatting.',
          '- Default to balanced mode when no mode is specified.',
          '- Optionally accept a file parameter to specify the target instruction file.',
          '- Append to the first discovered instruction file when no file parameter is specified.',
          '- Call this tool AFTER format-rules.',
        ].join('\n'),
      }),

      'parse-prompt': createParsePromptTool({
        description: [
          '- Decompose messy, ambiguous, or voice-transcribed user input into a structured task hierarchy.',
          '- The tasks parameter is required and must be a JSON string matching the schema described in the parameter.',
          '- Validates the parsed tasks against the schema and returns the validated JSON.',
          '- Call this tool BEFORE format-prompt.',
        ].join('\n'),
      }),

      'format-prompt': createFormatPromptTool({
        client,
        description: [
          '- Render validated tasks from parse-prompt into a formatted markdown tree view.',
          '- The tasks parameter is required and must be a JSON string matching the schema described in the parameter.',
          '- Return formatted markdown after rendering the task tree.',
          '- Call this tool AFTER parse-prompt.',
        ].join('\n'),
      }),
    },
  }
}

export default plugin
