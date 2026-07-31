# Feature-first architecture

Create each domain as an isolated feature under `src/features/<feature-name>`.

Recommended layout:

- `components/` - feature-scoped UI
- `hooks/` - feature-scoped hooks
- `screens/` - route-level feature screens
- `services/` - API/Firebase/data logic
- `types/` - feature model and schema types

Use `src/features/_template` as the base scaffold for new features.
