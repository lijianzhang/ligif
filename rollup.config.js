import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';
import typescript from 'rollup-plugin-typescript2';


const env = process.env.NODE_ENV;

const config = {
    input: 'src/index.ts',
    output: {
        format: 'umd',
        name: 'ligif',
    },
    plugins: [
        nodeResolve(),
        typescript(),
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
