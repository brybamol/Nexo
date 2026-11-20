import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // La lógica nunca usa la hora real: el "ahora" sale de la tabla reloj (obtenerAhora).
    files: [
      'src/motor/**/*.{ts,tsx}',
      'src/servicios/**/*.{ts,tsx}',
      'src/ia/**/*.{ts,tsx}',
      'src/dominio/**/*.{ts,tsx}',
      'src/db/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'No uses la hora real: lee el reloj de la demo (obtenerAhora / inst.ahora).',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'No uses new Date() sin argumentos: lee el reloj de la demo (obtenerAhora / inst.ahora).',
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.data/**', 'node_modules/**']),
]);

export default eslintConfig;
