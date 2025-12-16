import { defineConfig } from "tsup";

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'], // Build both formats
  dts: true, // Generate declarations
  clean: true,
  sourcemap: true,
  splitting: false,
  // Important: separate output directories
  outDir: 'dist',
  // For ESM build
  esbuildOptions: (options) => {
    options.format = 'esm';
    return options;
  },

});
