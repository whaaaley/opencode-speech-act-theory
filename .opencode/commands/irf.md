---
description: Parse instructions into structured rules using IRF
---

Parse the following instruction text into structured rules using the `irf-parse` tool, then format them into human-readable rules using the `irf-format` tool.

Steps:
1. Call `irf-parse` with the instruction text as `instructions` and your parsed JSON as `output`. The output must be valid JSON: `{"rules": [{"strength": "...", "action": "...", "target": "...", "context": "...", "reason": "..."}]}`. Strength values: obligatory, permissible, forbidden, optional, supererogatory, indifferent, omissible.
2. If validation fails, fix the issues and call `irf-parse` again.
3. Once parsing succeeds, call `irf-format` with the validated JSON as `parsed_rules` and your formatted rules as `output`. The output must be valid JSON: `{"rules": ["Rule text 1", "Rule text 2"]}`.
4. If validation fails, fix the issues and call `irf-format` again.
5. Present the final formatted rules to the user.

Instructions to parse:

$ARGUMENTS
