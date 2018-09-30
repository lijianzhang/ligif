import typescript from 'rollup-plugin-typescript2';
import serve from  'rollup-plugin-serve';


const env = process.env.NODE_ENV;
const override = { compilerOptions: { declaration: false }, include: ["src/**/*", "example/**/*"] };
const config = {
    input: 'example/index.ts',
    output: {
        format: 'umd',
        file: 'example/example.js'
    },
    paths: {
        'worker#**': './src/core/workers/**'
    },
    plugins: [
        serve({
            contentBase: 'example/',
            port: 1234,
        }),
        typescript({ tsconfig: 'tsconfig.json', tsconfigOverride: override }),
    ],
};

export default config;
