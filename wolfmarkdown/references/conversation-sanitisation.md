# Conversation sanitisation

Apply only after classification. If the document is an interview, transcript, dialogue, support exchange, or prompt-response sequence, keep the speaker structure.

## Remove when they are only scaffolding

Conversational introductions such as "Sure, here's the updated version", "Absolutely. I've cleaned this up", or "Here's what I found".

Conversational closings such as "Let me know if you'd like me to make any further changes", "Would you like me to create the PR?", or "Hope that helps."

Agent status commentary such as "I have now implemented the requested changes" or "The tests are currently running", unless a factual finding is embedded.

Speaker labels such as `User:`, `Assistant:`, `Codex:`, `Agent:`, `Gemini:`, `Claude:`, or `Grok:` when they are copied chat chrome rather than documented dialogue.

Agent meta-commentary such as "As an AI", "I searched", or "I think" when it is only voice.

## Rewrite to keep facts

`I checked the implementation and discovered that the transaction requires two signers.` becomes `The transaction requires two signers.`

`I think Privy is the strongest option because it supports the required signing model.` becomes `Privy is the strongest option because it supports the required signing model.`

For Compose, also rewrite conversation-dependent phrasing into standalone prose:

- "As we discussed above" becomes the actual subject, not a pointer at the chat.
- "You asked about X" becomes a heading or opening about X.
- "The option I mentioned earlier" becomes the option named explicitly.

Do not invent facts to fill a gap.

## Do not sanitise

Fenced code, test fixtures, quoted transcripts, prompt examples, source quotations, sample inputs, and debugging fixtures. `console.log("Assistant: hello")` inside a fence stays.

## Emoji

Remove decorative emoji during this phase when they do not carry meaning. `Tests passed ✅` may become `Tests passed.`

Keep emoji that are the subject of the document, part of a literal example, part of code, or otherwise technically meaningful. `The affected characters are ✅, ❌ and ⚠️.` stays.

The formatter must not delete emoji. That decision is this phase.
