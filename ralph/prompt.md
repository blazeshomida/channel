# Issues

The task context contains every open local issue from `issues/`.

Work on AFK issues only. An issue is blocked until every issue named under `## Blocked by` has been
moved to `issues/done/`.

If no AFK issue is ready, end your response with:

```txt
<promise>NO MORE TASKS</promise>
```

# Task selection

Choose one ready issue. Prioritize:

1. Critical bug fixes
2. Development infrastructure
3. Tracer bullets
4. Polish and quick wins
5. Refactors

# Work

Read `AGENTS.md`, inspect the current code and recent commits, and complete the selected issue using
test-first development.

Run the repository's feedback loops and create one scoped commit. Include the completed issue move
in that commit.

When complete, move the issue from `issues/` to `issues/done/` and end your response with:

```txt
<promise>ISSUE COMPLETE</promise>
```

If incomplete, leave the issue open, append a concise progress note to it, and end with:

```txt
<promise>ISSUE INCOMPLETE</promise>
```

# Final rule

Only work on one issue.
