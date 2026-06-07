import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Options = {
  threshold: number;
  maxChangedRatio: number;
  maxChangedBoundsRatio: number;
  minBoundsChangedRatio: number;
  ignores: Rect[];
  diffOutput?: string;
};

type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const usage = (): never => {
  console.error([
    'Usage: visualDiff <reference.png> <candidate.png> [--threshold=<mean-rgb-delta>] [--max-changed-ratio=<0-1>] [--max-changed-bounds-ratio=<0-1>] [--min-bounds-changed-ratio=<0-1>] [--ignore=x,y,width,height] [--diff-output=diff.png]',
    '',
    'Example:',
    '  npm run audit:ui-reference -- public/docs/upload.png /tmp/live.png --ignore=50,804,1180,159 --diff-output=/tmp/ui-diff.png',
  ].join('\n'));
  process.exit(2);
};

const parseRect = (value: string): Rect => {
  const parts = value.split(',').map(part => Number(part.trim()));
  if (parts.length !== 4 || parts.some(part => !Number.isFinite(part))) {
    throw new Error(`Invalid rectangle "${value}". Expected x,y,width,height.`);
  }
  const [x, y, width, height] = parts;
  assert(width >= 0 && height >= 0, 'Ignore rectangle width and height must be non-negative.');
  return { x, y, width, height };
};

const parseArgs = (): { referencePath: string; candidatePath: string; options: Options } => {
  const positional: string[] = [];
  const options: Options = {
    threshold: 0.15,
    maxChangedRatio: 0.005,
    maxChangedBoundsRatio: 0.1,
    minBoundsChangedRatio: 0,
    ignores: [],
  };

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--threshold=')) {
      const threshold = Number(arg.slice('--threshold='.length));
      if (!Number.isFinite(threshold) || threshold < 0) {
        throw new Error(`Invalid threshold "${arg}".`);
      }
      options.threshold = threshold;
      continue;
    }
    if (arg.startsWith('--max-changed-ratio=')) {
      const maxChangedRatio = Number(arg.slice('--max-changed-ratio='.length));
      if (!Number.isFinite(maxChangedRatio) || maxChangedRatio < 0 || maxChangedRatio > 1) {
        throw new Error(`Invalid max changed ratio "${arg}".`);
      }
      options.maxChangedRatio = maxChangedRatio;
      continue;
    }
    if (arg.startsWith('--max-changed-bounds-ratio=')) {
      const maxChangedBoundsRatio = Number(arg.slice('--max-changed-bounds-ratio='.length));
      if (!Number.isFinite(maxChangedBoundsRatio) || maxChangedBoundsRatio < 0 || maxChangedBoundsRatio > 1) {
        throw new Error(`Invalid max changed bounds ratio "${arg}".`);
      }
      options.maxChangedBoundsRatio = maxChangedBoundsRatio;
      continue;
    }
    if (arg.startsWith('--min-bounds-changed-ratio=')) {
      const minBoundsChangedRatio = Number(arg.slice('--min-bounds-changed-ratio='.length));
      if (!Number.isFinite(minBoundsChangedRatio) || minBoundsChangedRatio < 0 || minBoundsChangedRatio > 1) {
        throw new Error(`Invalid min bounds changed ratio "${arg}".`);
      }
      options.minBoundsChangedRatio = minBoundsChangedRatio;
      continue;
    }
    if (arg.startsWith('--ignore=')) {
      options.ignores.push(parseRect(arg.slice('--ignore='.length)));
      continue;
    }
    if (arg.startsWith('--diff-output=')) {
      const outputPath = arg.slice('--diff-output='.length).trim();
      if (!outputPath) {
        throw new Error('Missing path for --diff-output.');
      }
      options.diffOutput = outputPath;
      continue;
    }
    positional.push(arg);
  }

  if (positional.length !== 2) {
    usage();
  }

  return {
    referencePath: positional[0],
    candidatePath: positional[1],
    options,
  };
};

const readImageData = async (imagePath: string): Promise<ImageData> => {
  const image = await loadImage(imagePath);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, image.width, image.height);
};

const isIgnored = (x: number, y: number, ignores: Rect[]): boolean => (
  ignores.some(rect => (
    x >= rect.x &&
    x < rect.x + rect.width &&
    y >= rect.y &&
    y < rect.y + rect.height
  ))
);

const writeDiffImage = (
  reference: ImageData,
  candidate: ImageData,
  ignores: Rect[],
  outputPath: string,
): void => {
  const canvas = createCanvas(reference.width, reference.height);
  const context = canvas.getContext('2d');
  const diff = context.createImageData(reference.width, reference.height);

  for (let y = 0; y < reference.height; y += 1) {
    for (let x = 0; x < reference.width; x += 1) {
      const index = (y * reference.width + x) * 4;
      const pixelDelta = (
        Math.abs(reference.data[index] - candidate.data[index]) +
        Math.abs(reference.data[index + 1] - candidate.data[index + 1]) +
        Math.abs(reference.data[index + 2] - candidate.data[index + 2])
      ) / 3;

      if (isIgnored(x, y, ignores)) {
        diff.data[index] = Math.round(reference.data[index] * 0.2);
        diff.data[index + 1] = Math.round(reference.data[index + 1] * 0.25 + 36);
        diff.data[index + 2] = Math.round(reference.data[index + 2] * 0.35 + 86);
        diff.data[index + 3] = 255;
        continue;
      }

      if (pixelDelta > 2) {
        const intensity = Math.min(255, Math.round(72 + pixelDelta * 3));
        diff.data[index] = intensity;
        diff.data[index + 1] = Math.max(0, 48 - Math.round(pixelDelta));
        diff.data[index + 2] = Math.max(0, 32 - Math.round(pixelDelta));
        diff.data[index + 3] = 255;
        continue;
      }

      const dim = Math.round((
        candidate.data[index] +
        candidate.data[index + 1] +
        candidate.data[index + 2]
      ) / 12);
      diff.data[index] = dim;
      diff.data[index + 1] = dim;
      diff.data[index + 2] = dim;
      diff.data[index + 3] = 255;
    }
  }

  context.putImageData(diff, 0, 0);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, canvas.toBuffer('image/png'));
};

const main = async (): Promise<void> => {
  const { referencePath, candidatePath, options } = parseArgs();
  const [reference, candidate] = await Promise.all([
    readImageData(referencePath),
    readImageData(candidatePath),
  ]);

  assert.equal(candidate.width, reference.width, 'Candidate width must match reference width.');
  assert.equal(candidate.height, reference.height, 'Candidate height must match reference height.');

  let comparedPixels = 0;
  let changedPixels = 0;
  let totalDelta = 0;
  let maxPixelDelta = 0;
  let minChangedX = Number.POSITIVE_INFINITY;
  let minChangedY = Number.POSITIVE_INFINITY;
  let maxChangedX = Number.NEGATIVE_INFINITY;
  let maxChangedY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < reference.height; y += 1) {
    for (let x = 0; x < reference.width; x += 1) {
      if (isIgnored(x, y, options.ignores)) {
        continue;
      }

      const index = (y * reference.width + x) * 4;
      const pixelDelta = (
        Math.abs(reference.data[index] - candidate.data[index]) +
        Math.abs(reference.data[index + 1] - candidate.data[index + 1]) +
        Math.abs(reference.data[index + 2] - candidate.data[index + 2])
      ) / 3;

      comparedPixels += 1;
      totalDelta += pixelDelta;
      maxPixelDelta = Math.max(maxPixelDelta, pixelDelta);
      if (pixelDelta > 2) {
        changedPixels += 1;
        minChangedX = Math.min(minChangedX, x);
        minChangedY = Math.min(minChangedY, y);
        maxChangedX = Math.max(maxChangedX, x);
        maxChangedY = Math.max(maxChangedY, y);
      }
    }
  }

  const meanDelta = comparedPixels > 0 ? totalDelta / comparedPixels : 0;
  const changedRatio = comparedPixels > 0 ? changedPixels / comparedPixels : 0;
  const changedBounds: Bounds | null = changedPixels > 0
    ? {
        x: minChangedX,
        y: minChangedY,
        width: maxChangedX - minChangedX + 1,
        height: maxChangedY - minChangedY + 1,
      }
    : null;
  const changedBoundsRatio = changedBounds
    ? (changedBounds.width * changedBounds.height) / comparedPixels
    : 0;
  const checkedChangedBounds = changedRatio >= options.minBoundsChangedRatio;
  const result = {
    referencePath,
    candidatePath,
    width: reference.width,
    height: reference.height,
    ignoredRegions: options.ignores,
    comparedPixels,
    meanDelta: Number(meanDelta.toFixed(4)),
    maxPixelDelta: Number(maxPixelDelta.toFixed(4)),
    changedRatio: Number(changedRatio.toFixed(6)),
    changedBounds,
    changedBoundsRatio: Number(changedBoundsRatio.toFixed(6)),
    threshold: options.threshold,
    maxChangedRatio: options.maxChangedRatio,
    maxChangedBoundsRatio: options.maxChangedBoundsRatio,
    minBoundsChangedRatio: options.minBoundsChangedRatio,
    checkedChangedBounds,
    diffOutput: options.diffOutput,
    passed: (
      meanDelta <= options.threshold &&
      changedRatio <= options.maxChangedRatio &&
      (!checkedChangedBounds || changedBoundsRatio <= options.maxChangedBoundsRatio)
    ),
  };

  if (options.diffOutput) {
    writeDiffImage(reference, candidate, options.ignores, options.diffOutput);
  }

  console.log(JSON.stringify(result, null, 2));

  if (!result.passed) {
    process.exitCode = 1;
  }
};

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
