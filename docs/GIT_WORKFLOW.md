# Git workflow

30studio uses Git Flow. The repository is initialized with `main` as the stable branch and `develop` as the integration branch.

## Branches

| Branch | Purpose |
|---|---|
| `main` | Reviewed, release-ready product state |
| `develop` | Integration branch for the next release |
| `feature/<name>` | Product work branched from and merged back into `develop` |
| `release/<version>` | Release hardening branched from `develop`, merged into `main` and back into `develop` |
| `hotfix/<name>` | Urgent production correction branched from `main`, merged into both `main` and `develop` |

## Start and finish work

```sh
git switch develop
git flow feature start brand-kit
# implement and commit the feature
git flow feature finish brand-kit
```

Create a release with `git flow release start 0.1.0`; finish it with `git flow release finish 0.1.0` after review and validation. Use `git flow hotfix start <name>` only for a production correction.

Do not commit work directly to `main`. Keep feature branches focused, use pull requests when a remote is configured, and require build, lint, typecheck, and feature-specific acceptance evidence before release. No remote is configured in this local repository yet.

## Commit format

Use Conventional Commit subjects: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `perf:`, `security:`, or `chore:`. Keep each commit reviewable and do not include credentials, local environment files, build outputs, or customer data.
