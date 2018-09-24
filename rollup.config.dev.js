import commonjs from 'rollup-plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import serve from  'rollup-plugin-serve';

const env = process.env.NODE_ENV;

const config = {
    input: 'example/index.ts',
    output: {
        format: 'umd',
        file: 'example/example.js'
    },
    plugins: [
        serve({
            contentBase: 'example/',
            port: 1234,
        }),
        typescript({ declaration: false }),
    ],
};

export default config;
