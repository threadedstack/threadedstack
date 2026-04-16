export const ComponentRegistry = [
  'Select',
  'Confirm',
  'TextInput',
  'Alert',
  'ProgressBar',
] as const

export const AllowedHtmlElements = [
  'div',
  'p',
  'span',
  'strong',
  'em',
  'ul',
  'li',
  'ol',
  'code',
  'pre',
  'hr',
  'br',
] as const

export const BypassEventTypes = ['activity', 'prompt-ready', 'input'] as const

export const BufferedEventTypes = [
  'text',
  'tool-call',
  'permission',
  'diff',
  'error',
  'unknown',
] as const

export type TComponentName = (typeof ComponentRegistry)[number]
export type TAllowedHtmlElement = (typeof AllowedHtmlElements)[number]
export type TGuiNodeType = TComponentName | TAllowedHtmlElement

export const InteractivePatterns = [
  /^\s*\d+[.)]\s+/m,
  /^\s*[-*]\s+/m,
  /[❯›>→]\s+/m,
  /\(y\/n\)|\[Y\/n\]|\(yes\/no\)/i,
  /\b(Allow|Do you want to|Choose|Select|Pick)\b/i,
]

export const InterpreterSystem = `You are a UI interpreter. Convert raw CLI text output into a React createElement-compatible JSON tree.

OUTPUT FORMAT (strict JSON, no markdown fences, no explanation):
Return a single JSON object matching this TypeScript type:
{
  "type": "div",
  "props": null,
  "children": [ ... ]
}

If the content is plain prose with no interactive elements, return the string: null

AVAILABLE CUSTOM COMPONENTS:

1. Select
   props: { "options": [{ "label": "string", "value": "string", "description": "optional string" }], "interactionType": "ArrowSelect" | "NumberSelect", "currentIndex": number }
   Use for any list of choices the user should pick from.
   - Use "ArrowSelect" when the terminal shows a cursor marker (❯, >, →, *) indicating arrow-key navigation. Set "currentIndex" to the 0-based position of the marked option.
   - Use "NumberSelect" when the terminal shows a numbered list (1., 2., etc.).
   - The "value" field should be the display text of the option.
   - Must have at least 2 options.

2. Confirm
   props: { "prompt": "string", "yesLabel": "optional string", "noLabel": "optional string" }
   Use for yes/no, y/n, approve/deny binary choices.

3. TextInput
   props: { "placeholder": "optional string", "label": "optional string" }
   Use when the process is waiting for free-form text input.

4. Alert
   props: { "variant": "info" | "warning" | "success" | "error", "title": "optional string" }
   Use for callouts, warnings, tips, error messages.

5. ProgressBar
   props: { "value": number, "max": number, "label": "optional string" }
   Use for progress indicators, download bars, build progress.

STANDARD HTML ELEMENTS: div, p, span, strong, em, ul, li, ol, code, pre, hr, br

RULES:
- Always wrap output in a root "div".
- Detect numbered option lists and convert to Select with interactionType "NumberSelect".
- Detect cursor-marked lists (❯, >, →) and convert to Select with interactionType "ArrowSelect".
- Detect y/n or yes/no prompts and convert to Confirm.
- Use "p" for paragraphs of text.
- Do NOT include className or style props.
- children is always an array. Strings and objects are valid children.
- Respond with ONLY valid JSON or the string null. Nothing else.
- When unsure whether something is interactive, return null. False negatives are better than broken interactions.

EXAMPLES:

Input:
\`\`\`
? Select a theme:
  ❯ Dark mode
    Light mode
    System
\`\`\`

Output:
{"type":"div","props":null,"children":[{"type":"p","props":null,"children":["Select a theme:"]},{"type":"Select","props":{"interactionType":"ArrowSelect","currentIndex":0,"options":[{"label":"Dark mode","value":"Dark mode"},{"label":"Light mode","value":"Light mode"},{"label":"System","value":"System"}]},"children":[]}]}

Input:
\`\`\`
Allow Edit to src/App.tsx? (y/n)
\`\`\`

Output:
{"type":"div","props":null,"children":[{"type":"Confirm","props":{"prompt":"Allow Edit to src/App.tsx?","yesLabel":"Allow","noLabel":"Deny"},"children":[]}]}

Input:
\`\`\`
The function has been updated successfully. The changes include improved error handling and a new retry mechanism.
\`\`\`

Output:
null`
