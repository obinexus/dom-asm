import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import alias from '@rollup/plugin-alias';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';
import path from 'path';
import pkg from './package.json';

const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * (c) 2025 Nnamdi Michael Okpala
 * @license MIT
 */`;

// Domain-specific alias configuration for strict separation of concerns
const domainAliases = {
  '@dom-asm/core': path.resolve('./src/core'),
  '@dom-asm/html': path.resolve('./src/html'),
  '@dom-asm/css': path.resolve('./src/css'),
  '@dom-asm/js': path.resolve('./src/js'),
  '@dom-asm/state-machine': path.resolve('./src/state-machine'),
  '@dom-asm/advanced': path.resolve('./src/advanced')
};

// Shared configuration for all builds
const baseConfig = {
  input: 'src/index.ts',
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    // Domain-specific external references
    '@dom-asm/core',
    '@dom-asm/html',
    '@dom-asm/css',
    '@dom-asm/js',
    '@dom-asm/state-machine'
  ],
  plugins: [
    alias({
      entries: domainAliases
    }),
    resolve({
      preferBuiltins: true
    }),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' })
  ]
};

// Create individual module configurations with domain isolation
const createModuleConfig = (input, name) => ({
  ...baseConfig,
  input: `src/${input}/index.ts`,
  external: [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
    // Cross-domain dependencies (allowed)
    '@dom-asm/core',
    '@dom-asm/state-machine'
  ],
  output: [
    {
      file: `dist/dom-asm-${name}.js`,
      format: 'cjs',
      sourcemap: true,
      banner
    },
    {
      file: `dist/dom-asm-${name}.esm.js`,
      format: 'es',
      sourcemap: true,
      banner
    },
    {
      file: `dist/dom-asm-${name}.umd.js`,
      format: 'umd',
      name: `domasm${name.charAt(0).toUpperCase() + name.slice(1)}`,
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
  
  // Individual domain modules with strict isolation
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
      alias({
        entries: domainAliases
      }),
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
