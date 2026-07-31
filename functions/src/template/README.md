# Functions feature template

Use this pattern for new backend domains:

- `functions/src/<feature>/` for feature-specific handlers
- shared bootstrap in `admin.ts` and `config.ts`
- export public handlers from `functions/src/index.ts`
