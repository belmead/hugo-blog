import { defineConfig } from 'vite';
export default defineConfig({ base: '/studio/', server: { watch: { ignored: ['**/site/**','**/site.building/**','**/source-reference/**','**/content/**','**/output/**'] } }, build: { outDir: 'dist/studio', emptyOutDir: true } });
