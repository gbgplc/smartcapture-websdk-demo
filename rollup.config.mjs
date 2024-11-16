import resolve from '@rollup/plugin-node-resolve'; // Plugin to resolve modules in node_modules
import commonjs from '@rollup/plugin-commonjs'; // Plugin to convert CommonJS modules to ES6
import { babel } from '@rollup/plugin-babel'; // Plugin to transpile ES6+ code using Babel
import terser from '@rollup/plugin-terser'; // Plugin to minify the output bundle

export default {
    input: 'index.js', // Entry point of your application
    output: {
        file: 'dist/bundle.js', // Output file and location
        format: 'iife', // Output format: IIFE (Immediately Invoked Function Expression) for browser compatibility
        name: 'SmartcaptureWebsdkDemo', // Global variable name for the IIFE
        sourcemap: true // Enable source maps in Rollup
    },
    plugins: [
        resolve(), // Resolves modules from node_modules
        commonjs(), // Converts CommonJS modules to ES6
        babel({
            babelHelpers: 'bundled', // Uses bundled Babel helpers instead of including them in every file
            exclude: 'node_modules/**' // Excludes node_modules from Babel transpilation
        }),
        terser() // Minifies the output for better performance
    ],
    external: []
};