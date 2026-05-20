import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(here, 'index.html'),
    path.join(here, 'src/**/*.{js,jsx,ts,tsx}'),
  ],
  theme: { extend: {} },
  plugins: [],
};
