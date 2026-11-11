#!/usr/bin/env node
// wardogs-calculator 镜像站后处理 —— 在仓库根目录(repo/)运行,处理 ./dist
// 1) 瓦片/地形绝对 R2 URL → 同源反代路径 /wardogs/r2/(加载器 new URL 支持)
// 2) config/app.json: collab/feedback 置 false(作者后端 allowedOrigins 不含本域)
// 3) 全部 HTML:删除 umami 统计标签、R2 preconnect/dns-prefetch(镜像站零外联)
// 4) 删除 GitHub Pages 专用 CNAME
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'dist');
// 只替换到 /releases/ 层:上游日后发布 assets-v2 时无需改 nginx(反代前缀 /wardogs/r2/ 版本无关)
const R2 = 'https://assets.wardogs-artillery.com/releases/';
const LOCAL = '/wardogs/r2/';

// --- 1) 前缀替换:3 张图各 3 处 path + terrain-context 4 处 manifest = 13
let rewritten = 0;
for (const f of [
  join(DIST, 'maps', 'bakurani.json'),
  join(DIST, 'maps', 'ozeti.json'),
  join(DIST, 'maps', 'zestafona.json'),
  join(DIST, 'data', 'ballistics', 'terrain-context.json'),
]) {
  let s = readFileSync(f, 'utf8');
  const n = s.split(R2).length - 1;
  writeFileSync(f, s.split(R2).join(LOCAL));
  rewritten += n;
}
console.log(`[1] tiles/terrain URL rewritten: ${rewritten} (expect 13)`);

// --- 1b) 禁用资产访问验证(自托管部署不需要 Turnstile 验证)
// isProtectedAssetURL 检测瓦片 URL 是否来自作者 CDN,是则要求 Turnstile 人机验证
// 自托管部署:改名原函数(永不调用)+ 前置同名函数返回 false(= 非受保护,跳过验证)
let guardPatched = 0;
for (const bundle of ['js/app.bundle.js', 'js/mobile.bundle.js']) {
  const p = join(DIST, bundle);
  if (!existsSync(p)) continue;
  let s = readFileSync(p, 'utf8');
  if (s.includes('function isProtectedAssetURL')) {
    s = 'function isProtectedAssetURL(value) { return false; }\n' +
        s.replace(/function isProtectedAssetURL/g, 'function _DISABLED_isProtectedAssetURL');
    writeFileSync(p, s);
    guardPatched++;
  }
}
console.log(`[1b] asset access guard disabled: ${guardPatched} bundles patched`);

// --- 1c) 禁用 assetGateway 配置(阻止 /__session 和 Turnstile 请求)
// BUILT_APP_CONFIG 里 assetGateway.enabled=true 会让 ensureAssetAccess() 去作者 CDN 拿会话
// 改成 false 后 isAssetGatewayEnabled() 返回 false → ensureAssetAccess() 直接 return true
let gatewayPatched = 0;
for (const bundle of ['js/app.bundle.js', 'js/mobile.bundle.js']) {
  const p = join(DIST, bundle);
  if (!existsSync(p)) continue;
  let s = readFileSync(p, 'utf8');
  if (s.includes('"assetGateway":{"enabled":true')) {
    s = s.replaceAll('"assetGateway":{"enabled":true', '"assetGateway":{"enabled":false');
    writeFileSync(p, s);
    gatewayPatched++;
  }
}
// config/app.json 也可能有
const cfgPath = join(DIST, 'config', 'app.json');
if (existsSync(cfgPath)) {
  let cfg = readFileSync(cfgPath, 'utf8');
  if (cfg.includes('"assetGateway"') && cfg.includes('"enabled": true')) {
    cfg = cfg.replace(/("assetGateway"[\s\S]*?"enabled")\s*:\s*true/, '$1: false');
    writeFileSync(cfgPath, cfg);
    console.log('[1c] config/app.json assetGateway disabled');
  }
}
console.log(`[1c] assetGateway disabled: ${gatewayPatched} bundles`);

// --- 1d) 禁用 core/asset-access.js 的 ensureAssetAccess(独立模块,不随 bundle 补丁生效)
// 这个模块被 app 独立 import,里面的 ensureAssetAccess 会直接请求作者 CDN 的 /__session
// 必须单独补丁,否则下次重建后 /__session 请求会回来
const assetAccessPath = join(DIST, 'js', 'core', 'asset-access.js');
if (existsSync(assetAccessPath)) {
  let s = readFileSync(assetAccessPath, 'utf8');
  if (s.includes('async function ensureAssetAccess')) {
    s = 'async function ensureAssetAccess(options) { return true; }\n' +
        s.replace(/async function ensureAssetAccess/g, 'async function _DISABLED_ensureAssetAccess');
    writeFileSync(assetAccessPath, s);
    console.log('[1d] core/asset-access.js ensureAssetAccess → always true');
  }
}

// --- 2) 关闭协作大厅与反馈
const appPath = join(DIST, 'config', 'app.json');
const app = JSON.parse(readFileSync(appPath, 'utf8'));
if (app.collab) app.collab.enabled = false;
if (app.feedback) app.feedback.enabled = false;
writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
console.log('[2] collab.enabled=false feedback.enabled=false');

// --- 3) HTML 清理
let htmlCount = 0, umami = 0, r2link = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!name.endsWith('.html')) continue;
    htmlCount++;
    const before = readFileSync(p, 'utf8');
    const after = before
      .replace(/<script[^>]*cloud\.umami\.is\/script\.js[^>]*><\/script>\s*/g, '')
      .replace(/<link[^>]*assets\.wardogs-artillery\.com[^>]*>\s*/g, '');
    if (after !== before) {
      umami += (before.match(/cloud\.umami\.is\/script\.js/g) || []).length;
      r2link += (before.match(/<link[^>]*assets\.wardogs-artillery\.com[^>]*>/g) || []).length;
      writeFileSync(p, after);
    }
  }
};
walk(DIST);
console.log(`[3] html=${htmlCount} umami-removed=${umami} r2-link-removed=${r2link}`);

// --- 4) CNAME 删除
const cname = join(DIST, 'CNAME');
if (existsSync(cname)) { unlinkSync(cname); console.log('[4] removed CNAME'); }
