---
name: example-skill
description: REPLACE THIS. The description is the only thing Claude sees when deciding whether to load this skill, so it must name the concrete situations that should trigger it - including the phrasings a user would actually type. Say what the skill does, then list the triggers.
---

# Example Skill

Write the instructions Claude should follow when this skill loads. The frontmatter
decides *whether* the skill fires; this body decides *what happens* once it does.

## Write for an agent, not for a person

An agent reads this every time the skill fires and has no memory of the last time.
Prefer a rule it can check over advice it has to interpret.

| Instead of | Write |
|---|---|
| "Be careful with migrations" | "Any schema change without a rollback path is `blocking`" |
| "Consider the edge cases" | "Check: empty input, network error, concurrent calls" |
| "Use good judgement on severity" | A table that maps each label to a decision test |

## Give it a decision procedure, not a topic

The useful part of a skill is usually an ordered procedure or a rubric - something
that makes two different sessions reach the same answer on the same input. If this
file only explains a topic, the model already knew the topic and the skill adds nothing.

## Say what not to do

Failure modes are worth as much as instructions, because they are what the model
would otherwise do by default:

- Do not restate what the user already told you.
- Do not stop at the first plausible answer when the task asked for a comparison.

## Reference files

Keep this file short enough to read every time. Push long reference material into
sibling files and point at them by relative path, so they load only when needed:

    skills/example-skill/
      SKILL.md            <- always loaded when the skill fires
      reference/rubric.md <- read on demand
