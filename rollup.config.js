import nodeResolve from 'rollup-plugin-node-resolve';
import typescript from 'typescript';
import replace from 'rollup-plugin-replace';
import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';
import rollupTypescript from 'rollup-plugin-typescript';

const env = process.env.NODE_ENV;

const config = {
    input: 'src/index.ts',
    output: {
        format: 'umd',
        name: 'ligif',
    },
    plugins: [
        nodeResolve(),
        rollupTypescript({ typescript, importHelpers: true }),
        replace({
            'process.env.NODE_ENV': JSON.stringify(env),
        }),
        commonjs(),
    ],
};

if (env === 'production') {
    config.plugins.push(uglify({
        compress: {
            pure_getters: true,
            unsafe: true,
            unsafe_comps: true,
            warnings: false,
        },
    }));
}


export default config;
