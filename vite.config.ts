import { defineConfig } from 'vite';
import VuePlugin from '@vitejs/plugin-vue';

const isExample = !!process.env.EXAMPLE;

export default defineConfig((env) => isExample ? ({
    root: 'example',
    base: env.command === 'serve' ? '/' : '/ligif/',
    plugins: [VuePlugin()]
}) : ({
    esbuild: {
        target: "es6"
    },
    build: {
        target: 'es6',
        outDir: 'dist',
        lib: {
            name: 'ligif',
            entry: 'src/main.ts',
            formats: ['es', 'umd'],
        }
    },
}));
