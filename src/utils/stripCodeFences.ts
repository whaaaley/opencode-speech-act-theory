// strip markdown code fences from LLM response text
export const stripCodeFences = (text: string): string => {
  return text
    .replace(/^```(?:json)?\s*\n?/m, '')
    .replace(/\n?```\s*$/m, '')
    .trim()
}
