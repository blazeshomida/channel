# Ralph

This directory adapts the local-issues Ralph loop for this repository.

The queue lives in `issues/*.md`. Each iteration:

1. Passes every open issue and recent commit to Codex.
2. Lets Codex choose one ready AFK issue.
3. Implements and verifies that issue.
4. Moves its file to `issues/done/`.
5. Creates one commit containing the code and issue move.

Because every iteration runs on the same branch, one completed local issue immediately unlocks its
dependents. GitHub issue state is not consulted.

The runner independently requires:

- a clean worktree before and after the iteration
- exactly one new commit
- exactly one issue moved out of the open queue
- a passing `vpr ready`

It never pushes, opens pull requests, closes GitHub issues, or rewrites history.

## Usage

Preview the local queue:

```sh
./ralph/once.sh --dry-run
```

Run one issue:

```sh
./ralph/once.sh
```

Run up to six sequential issues:

```sh
./ralph/afk.sh 6
```

Run Ralph from a dedicated clean branch or worktree that already contains the feature prerequisites.
For the Peer runtime issues, begin after the contract-bound Peer work from PR #13 is present.
