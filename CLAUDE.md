## Agent skills

## Code style

Code explains itself through names and structure. Write no comments; the only exceptions are tool directives such as `// eslint-disable-next-line` and `/// <reference>`. When a reason, workaround, or constraint feels worth a comment, carry it in a name instead (a well-named function, constant, or variable). Scripts start directly with their code, without a shebang line.

## Secrets

`SPOTIFY_CLIENT_ID` is confidential. Reference it only by name: when checking `.env` or a build, test for presence or count matches, so the value itself never reaches a terminal, log, error message, commit, or conversation.
