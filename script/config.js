import path from 'path';
import { cwd } from 'process';

const config = [
  {
    src: path.join(cwd(), './src/main.ts'),
    format: 'cjs',
  },
  {
    src: path.join(cwd(), './src/main.ts'),
    format: 'es',
    copy: ['./src/type.d.ts'],
  },
];

export default config;
