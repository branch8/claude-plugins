# Record template

Write the headings and the content in the user's language. The structure below
is fixed; the section names are shown in English only here.

```markdown
# <KEY> <title>

Status: understanding | reviewing | waiting-for-pm | designing | done
Source: <Jira link> · <PRD link(s)>

## Purpose
- RD's version: <in the RD's words>
- Claude's additions and the differences: <...>
- (If the RD skipped the restatement: "Interpreted by Claude first.")

## Scenarios
| # | Given / When / Then | From (PRD / RD) | PM confirmed |
|---|---|---|---|

## Issues found
| # | Type (gap / conflict / infeasible / better way) | Found by (RD / Claude) | PM answer or assumption |
|---|---|---|---|

## Solution
- Way: think it through together | options
- Approaches considered, each with its trade-offs and proposed by (RD / Claude)
- Chosen approach, and the RD's reason (their words)
- Calls brainstorming made, as confirmed or changed by the RD
- What changed under grilling
- ADRs: <links>

## Collaboration
- Claude proposed: <...>
- RD thought / decided: <key sentences quoted in the RD's own words>

## Changes
- <YYYY-MM-DD>: <what changed in the requirement, who asked, which scenarios and decisions it touched>
```

The Changes section stays empty until the requirement changes after `done`.
