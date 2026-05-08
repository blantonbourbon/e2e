# Q1 Progress Diagram Maintainability Fix

## Context

The current `q1-playwright-progress` report works as a status artifact, but two maintainability problems showed up in review:

- the left lane is named `Q1 Completed Foundation`, which will mislabel post-Q1 completed work during future refreshes
- the draw.io file uses loose sibling cells instead of lane containers, which makes routine draw.io edits easier to drift out of alignment

## Decision

Keep the existing three-lane layout, colors, and milestone content, but make two targeted changes:

1. Rename the left lane to `Completed Foundation` so future quarterly refreshes can move finished roadmap items into that lane without implying they were finished in Q1.
2. Rebuild the three lanes as draw.io swimlane containers so each lane owns its cards structurally and can be moved or resized with less manual rework.

## Scope

This change updates only the maintained documentation assets:

- `docs/reports/q1-playwright-progress.drawio`
- `docs/reports/q1-playwright-progress.md`
- `docs/reports/q1-playwright-progress-preview.svg`

It does not change the underlying framework summary, repo-backed counts, or roadmap ordering.

## Verification

Verification for this fix should confirm:

- the draw.io XML remains well-formed
- the diagram still shows the same three logical lanes and milestones
- the markdown guidance now refers to `Completed Foundation`
- the repo-backed counts in the summary still match the repository state
