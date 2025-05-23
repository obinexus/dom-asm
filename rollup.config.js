import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';
import pkg from './package.json';

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * (c) 2025 Nnamdi Michael Okpala
 * @license MIT
 */`;

// Shared configuration for all builds
const baseConfig = {
  input: 'src/index.ts',
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {})
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' })
  ]
};

// Create individual module configurations
const createModuleConfig = (input, name) => ({
  ...baseConfig,
  input: `src/${input}/index.ts`,
  output: [
    {
      file: `dist/dom-asm-${name}.js`,
      format: 'cjs',
      sourcemap: true,
      banner
    }
  ]
});

export default [
  // Main bundle - UMD build (for browsers)
  {
    ...baseConfig,
    output: [
      {
        name: 'domasm',
        file: pkg.main,
        format: 'umd',
        sourcemap: true,
        banner
      },
      {
        name: 'domasm',
        file: 'dist/domasm.min.js',
        format: 'umd',
        sourcemap: true,
        plugins: [terser()],
        banner
      }
    ]
  },
  
  // ESM build (for bundlers)
  {
    ...baseConfig,
    output: {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
      banner
    }
  },
  
  // Individual modules
  createModuleConfig('core', 'core'),
  createModuleConfig('html', 'html'),
  createModuleConfig('css', 'css'),
  createModuleConfig('js', 'js'),
  
  // CLI bundle
  {
    ...baseConfig,
    input: 'src/cli/index.ts',
    output: {
      file: 'dist/domasm-cli.js',
      format: 'cjs',
      sourcemap: true,
      banner: '#!/usr/bin/env node\n' + banner
    },
    plugins: [
      resolve({ preferBuiltins: true }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' })
    ]
  },
  
  // Types bundle
  {
    input: 'src/index.ts',
    output: {
      file: pkg.types,
      format: 'es'
    },
    plugins: [dts()]
  }
];