# React + Phaser 3 + TypeScript (Base Template)

Production-ready React + Phaser 3 template intended to be duplicated into many small games.

## Quick start

```bash
npm install
npm run dev
```

## Where to edit for a new game

This project is designed so you can usually change **only** the gameplay scene.

Suggested structure:

```text
src/
  phaser/
    scenes/
      BootScene.ts
      PreloadScene.ts
      GameScene.ts      <-- main place to modify
      UIScene.ts
    config.ts
  GameTemplate.tsx      <-- React mounts/destroys Phaser
```

### Copy/paste checklist (duplicate this template)

1. Duplicate the whole folder (recommended) OR create a new repo from it.
2. Update `package.json` name/version as desired.
3. Change gameplay logic in `src/phaser/scenes/GameScene.ts`.
4. (Optional) If you need different UI (score/timer/buttons), edit `src/phaser/scenes/UIScene.ts`.

### What you should *not* need to touch

- `src/GameTemplate.tsx`: mounts Phaser via `useEffect`, destroys on unmount, resizes responsively.
- `src/phaser/config.ts`: Arcade physics config, registry keys, global events, scene list.
- `BootScene` / `PreloadScene`: global defaults + generated textures (no external assets).

### Global systems (score + countdown)

- Score and remaining time live in the Phaser **Registry** (`scene.registry`).
- UI updates via events emitted on `this.game.events` (see `src/phaser/config.ts`).
- Default round length is 60 seconds.

### Controls

- Desktop: arrow keys (cursor movement)
- UI: Pause/Resume + Restart

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
