# POLITICA DE PROTECCION DE DATOS (OBLIGATORIA)

El sistema es **netamente explicativo y demostrativo**. Queda **estrictamente prohibido**
incorporar informacion real de las empresas Zavidoro, Merco Sur y Meta Lab, sus
funcionarios, cedulas, salarios o cualquier dato personal o confidencial a este
repositorio, al codigo fuente, a los datos de ejemplo, a los presets o a cualquier
despliegue.

- Todo modelo, preset, ejemplo o prueba debe usar datos ficticios y genericos.
- El guard `scripts/check-no-sensitive-data.mjs` se ejecuta antes de cada build
  (`npm run build`) y **bloquea la compilacion** si detecta terminos prohibidos.
- Vercel ejecuta ese mismo build blindado (`buildCommand: npm run build` en `vercel.json`).

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
