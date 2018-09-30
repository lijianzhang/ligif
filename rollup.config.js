
import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';
import typescript from 'rollup-plugin-typescript2';

const override = { compilerOptions: { declaration: false, target: 'es5' } };

const env = process.env.NODE_ENV;

const config = {
    input: 'src/index.ts',
    output: {
        format: 'umd',
        name: 'ligif',
    },
    plugins: [
        typescript({ tsconfig: 'tsconfig.json', tsconfigOverride: override,  }),
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
