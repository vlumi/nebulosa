# Development rules

## Commits
- Incremental, honest history: each commit is one coherent step that builds and makes sense on its own.
- No huge blobs, no tiny noise (fix-typo-in-previous-commit churn). Squash locally *before* committing, never rewrite pushed history.
- Commit messages describe the step, not the process.

## Comments
- Minimal. A comment only where the code cannot be made to say it — prefer renaming and refactoring over explaining.
- No narration ("increment counter"), no changelog comments, no restating types.

## Code
- Clean and well-structured, but built iteratively: working first, then dedicated cleanup rounds. Don't gold-plate mid-feature; do flag debt worth a cleanup pass.
