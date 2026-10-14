import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  server: {
    port: 5174,
    open: true,
    proxy: {
      '/api/playbooks': 'http://localhost:8080',
    },
  },
  esbuild: {
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  },
});
