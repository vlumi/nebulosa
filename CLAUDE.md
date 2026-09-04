# Development rules

## Commits and pull requests

- Incremental, honest history: each commit is one coherent step that builds and makes sense on its own.
- No huge blobs, no tiny noise (fix-typo-in-previous-commit churn). Squash locally *before* committing.
- Commit messages describe the step, not the process.
- Every concrete chunk of work is a branch and a pull request against `main`, rebased on `main` before pushing. Rewriting and force-pushing an open PR branch to keep its history clean is fine; `main` is never rewritten.

## Comments

- Minimal. A comment only where the code cannot be made to say it; prefer renaming and refactoring over explaining.
- No narration ("increment counter"), no changelog comments, no restating types.

## Code

- Clean and well-structured, but built iteratively: working first, then dedicated cleanup rounds. Don't gold-plate mid-feature; do flag debt worth a cleanup pass.

## Documentation

- Markdown paragraphs are one line each; the editor wraps. `.markdownlint.jsonc` encodes this.
