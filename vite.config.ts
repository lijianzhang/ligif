import { defineConfig } from 'vite';

const isExample = !!process.env.EXAMPLE;

export default defineConfig((env) => isExample ? ({
    root: 'example',
    base: env.command === 'serve' ? '/' : '/ligif/'
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
