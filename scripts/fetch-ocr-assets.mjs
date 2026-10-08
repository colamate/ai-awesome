#!/usr/bin/env node
/**
 * 将手写 OCR 所需静态资源复制到 public/ocr/（本地离线，不走 CDN）。
 * 依赖：node_modules/tesseract.js、@tesseract.js-data/eng（npm i 后可用）。
 * 用法：node scripts/fetch-ocr-assets.mjs [--force]
 */
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'public', 'ocr');
const FORCE = process.argv.includes('--force');

const WORKER = 'worker.min.js';
const CORES = ['tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'];
const LANG_GZ = 'eng.traineddata.gz';

function fail(msg) {
  console.error(`[fetch-ocr-assets] ${msg}`);
  process.exit(1);
}

function ensureTesseract() {
  const dist = path.join(ROOT, 'node_modules', 'tesseract.js', 'dist');
  if (!existsSync(path.join(dist, WORKER))) {
    fail('未找到 node_modules/tesseract.js/dist，先运行 npm install');
  }
  const corePkg = path.join(ROOT, 'node_modules', 'tesseract.js-core');
  for (const core of CORES) {
    if (!existsSync(path.join(corePkg, core))) fail(`缺少 tesseract.js-core/${core}，版本不符`);
  }
  return { dist, corePkg };
}

function ensureLang() {
  const dest = path.join(OUT, LANG_GZ);
  if (existsSync(dest) && !FORCE) return dest;
  const data = path.join(ROOT, 'node_modules', '@tesseract.js-data', 'eng');
  const candidates = existsSync(data)
    ? readdirSync(path.join(data)).flatMap((v) => {
        const p = path.join(data, v, 'eng.traineddata.gz');
        return existsSync(p) ? [p] : [];
      })
    : [];
  if (candidates.length > 0) return candidates[0];
  return npmPackLang();
}

function npmPackLang() {
  const tmp = mkdtempSync(path.join(tmpdir(), 'ocr-lang-'));
  try {
    const pack = execFileSync('npm', ['pack', '@tesseract.js-data/eng@1.0.0', '--pack-destination', tmp, '--silent'], {
      encoding: 'utf8',
    }).trim();
    const tgz = path.join(tmp, pack.split('\n').pop());
    execFileSync('tar', ['-xzf', tgz, '-C', tmp]);
    const found = readdirSync(path.join(tmp, 'package'), { recursive: true })
      .map(String)
      .find((f) => f.endsWith('/eng.traineddata.gz') || f === 'eng.traineddata.gz');
    if (!found) fail('@tesseract.js-data/eng 包内未找到 eng.traineddata.gz');
    return path.join(tmp, 'package', found);
  } catch (e) {
    fail(`拉取语言包失败（npm pack @tesseract.js-data/eng）：${e.message}`);
  } finally {
    setTimeout(() => rmSync(tmp, { recursive: true, force: true }), 30_000).unref?.();
  }
}

function main() {
  mkdirSync(OUT, { recursive: true });
  const { dist, corePkg } = ensureTesseract();

  const copies = [
    [path.join(dist, WORKER), path.join(OUT, WORKER)],
    ...CORES.map((c) => [path.join(corePkg, c), path.join(OUT, c)]),
  ];
  let copied = 0;
  for (const [src, dest] of copies) {
    if (FORCE || !existsSync(dest)) {
      copyFileSync(src, dest);
      copied += 1;
    }
  }

  const langSrc = ensureLang();
  const langDest = path.join(OUT, LANG_GZ);
  if (FORCE || !existsSync(langDest)) {
    copyFileSync(langSrc, langDest);
    copied += 1;
  }

  const gz = readFileSync(langDest);
  if (gz[0] !== 0x1f || gz[1] !== 0x8b) fail('eng.traineddata.gz 不是 gzip（magic 校验失败）');

  console.log(
    `[fetch-ocr-assets] public/ocr 就绪（新复制 ${copied} 个文件）: ${[WORKER, ...CORES, LANG_GZ].join(', ')}`,
  );
}

main();
