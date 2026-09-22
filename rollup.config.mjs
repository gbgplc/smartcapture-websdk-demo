import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { babel } from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'node:fs';

const sdkPkg = JSON.parse(readFileSync(new URL('./node_modules/@gbgplc/smartcapture-web/package.json', import.meta.url)));
const sdkVersion = sdkPkg.version;

export default {
    input: 'index.js',
    output: {
        file: 'dist/bundle.js',
        format: 'iife',
        name: 'SmartcaptureWebsdkDemo',
        sourcemap: true,
        banner: `window.__SDK_VERSION__ = ${JSON.stringify(sdkVersion)};`,
    },
    plugins: [
        resolve(),
        commonjs(),
        babel({
            babelHelpers: 'bundled',
            exclude: 'node_modules/**',
        }),
        terser(),
    ],
    external: []
};