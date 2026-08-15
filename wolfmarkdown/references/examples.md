# Examples

## Compose / export

User asks: "Export this as Markdown" or "Present that as a Markdown file."

Source is conversation notes or research. The result is a new standalone `.md` file, not a cleaned chat transcript, unless the user asked for a transcript.

## Copied conversation

Before:

```text
Assistant:
Absolutely. Here's what I found
I think Privy is the best option because it supports the required signing model.
Let me know if you'd like me to investigate anything else.
```

After:

```markdown
# Current Verdict

Privy is the best option because it supports the required signing model.
```

## Decorative versus substantive emoji

`Tests passed ✅` may become `Tests passed.`

`The affected characters are ✅, ❌ and ⚠️.` stays.

A formatter-only run keeps both lines' characters.

## Malformed comparison

When columns are clear, rebuild a GFM table. Leave a cell empty rather than inventing a value.

## Transcript

An interview or support log keeps speaker labels and quoted emoji.

## Code

```javascript
console.log("Assistant: hello");
```

stays unchanged.
