#!/bin/bash
# wardogs-calculator 自动更新(2026-09-17)——由 /etc/cron.d/anhappy 每周调用,也可手动跑
# 逻辑:拉上游→有新提交才重建→三重校验→原子换版(dist-prev 保留可回滚)→任何失败保留旧版
set -u
BASE=/opt/services/wardogs
LOG=$BASE/update.log
exec >>"$LOG" 2>&1
echo "==== $(date '+%F %T') 更新检查 ===="
cd "$BASE/repo" || { echo "FATAL: repo 目录不存在"; exit 1; }
git fetch --depth 1 origin main >/dev/null 2>&1 || { echo "FATAL: git fetch 失败(网络?)"; exit 1; }
OLD=$(git rev-parse HEAD)
NEW=$(git rev-parse origin/main)
if [ "$OLD" = "$NEW" ]; then
  echo "无更新($NEW)"
  exit 0
fi
echo "发现更新: $OLD → $NEW"
git log --oneline HEAD..origin/main | head -8
git reset --hard origin/main >/dev/null || { echo "FATAL: reset 失败"; exit 1; }
docker run --rm -v "$BASE":/wd -w /wd/repo node:22-alpine sh -c "npm run build && node /wd/postbuild.mjs" || { echo "ERROR: 构建失败,保留旧版"; exit 1; }

# ---- 三重校验(上游若改结构,这里会拦下,不换版) ----
for f in maps/bakurani.json maps/ozeti.json maps/zestafona.json data/ballistics/terrain-context.json; do
  [ -f "dist/$f" ] || { echo "ERROR: 产物缺 $f,保留旧版"; exit 1; }
done
R=$(grep -c "assets\.wardogs-artillery\.com" dist/maps/bakurani.json dist/maps/ozeti.json dist/maps/zestafona.json dist/data/ballistics/terrain-context.json | awk -F: '{s+=$NF} END {print s+0}')
L=$(cat dist/maps/bakurani.json dist/maps/ozeti.json dist/maps/zestafona.json dist/data/ballistics/terrain-context.json | grep -o "/wardogs/r2/" | wc -l)
U=$(grep -rl "cloud.umami.is/script.js" dist --include="*.html" | wc -l)
echo "校验: R2残留=$R 本站前缀=$L umami标签=$U"
if [ "$R" != "0" ] || [ "$L" -lt 13 ] || [ "$U" != "0" ]; then
  echo "ERROR: 校验未过(上游结构可能变了),保留旧版,请人工检查 postbuild.mjs"
  exit 1
fi

# ---- 原子换版 ----
cd "$BASE" && rm -rf dist-prev && mv dist dist-prev && mv repo/dist dist
echo "OK: 已换版到 $(git -C repo log -1 --format='%h %ci')"
