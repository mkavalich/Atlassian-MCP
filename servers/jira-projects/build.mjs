import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import { readdir, stat, copyFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

// Copy manual .d.ts stub files from src to dist
async function copyDeclarationStubs(srcDir, distDir) {
  const files = await readdir(srcDir);

  for (const file of files) {
    const srcPath = join(srcDir, file);
    const distPath = join(distDir, file);
    const stats = await stat(srcPath);

    if (stats.isDirectory()) {
      // Recursively process subdirectories
      const subDistDir = join(distDir, file);
      if (!existsSync(subDistDir)) {
        await mkdir(subDistDir, { recursive: true });
      }
      await copyDeclarationStubs(srcPath, subDistDir);
    } else if (file.endsWith('.d.ts')) {
      // Copy .d.ts files to dist
      const destDir = dirname(distPath);
      if (!existsSync(destDir)) {
        await mkdir(destDir, { recursive: true });
      }
      await copyFile(srcPath, distPath);
      console.log(`Copied: ${srcPath} -> ${distPath}`);
    }
  }
}

// Find all TypeScript files in src directory
async function getEntryPoints(dir) {
  const entries = [];
  const files = await readdir(dir);

  for (const file of files) {
    const path = join(dir, file);
    const stats = await stat(path);

    if (stats.isDirectory()) {
      entries.push(...await getEntryPoints(path));
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      entries.push(path);
    }
  }

  return entries;
}

async function build() {
  const entryPoints = await getEntryPoints('./src');

  console.log(`Building ${entryPoints.length} TypeScript files...`);

  try {
    // Step 1: esbuild for JS output (fast transpilation)
    await esbuild.build({
      entryPoints,
      outdir: 'dist',
      platform: 'node',
      target: 'node20',
      format: 'esm',
      bundle: false,
      sourcemap: true,
      outExtension: { '.js': '.js' },
      logLevel: 'info',
    });

    // Step 2: Copy manual .d.ts stub files from src to dist
    console.log('Copying manual declaration stubs...');
    await copyDeclarationStubs('./src', './dist');

    // Step 3: tsc for declaration files only (optional, skip if SKIP_DECLARATIONS is set)
    if (process.env.SKIP_DECLARATIONS !== 'true') {
      console.log('Generating TypeScript declarations...');
      try {
        // Use cross-env to set NODE_OPTIONS for increased memory
        execSync('npx cross-env NODE_OPTIONS=--max-old-space-size=8192 tsc -p tsconfig.declarations.json', {
          stdio: 'inherit',
          timeout: 600000, // 10 minute timeout
        });
        console.log('Declaration files generated successfully');
      } catch (tscError) {
        // Check if declarations were generated despite the error
        const { existsSync } = await import('fs');
        if (existsSync('./dist/index.d.ts')) {
          console.log('Declaration files generated (tsc exited with error but files exist)');
        } else {
          console.warn('Warning: Declaration generation failed (likely OOM).');
          console.warn('To skip declarations: SKIP_DECLARATIONS=true npm run build');
          console.warn('To generate manually with more memory:');
          console.warn('  npx cross-env NODE_OPTIONS=--max-old-space-size=16384 tsc -p tsconfig.declarations.json');
        }
      }
    } else {
      console.log('Skipping declaration generation (SKIP_DECLARATIONS=true)');
    }

    console.log('Build completed successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
