# My Gita client

The client is a dependency-free, native ES-module application designed for GitHub Pages.

## Local preview

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open `http://127.0.0.1:8000/mygita/`. Phase 0 defaults to the fixture data-provider; API-backed feature repositories are introduced by vertical slice.

## Boundaries

- `src/core`: infrastructure with no feature-specific rendering.
- `src/shell`: application chrome and navigation.
- `src/ui`: reusable presentation primitives.
- `src/features`: feature-owned pages, services, repositories and styles (introduced in Phase 1 onward).
- `styles`: global tokens, base rules, layout and shared components.
