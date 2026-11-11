# WARDOGS 炮兵计算器·部署档案(anhappy.com /wardogs/ 下线归档)

> 本仓 = anhappy.com /wardogs/ 服务(2026-09-17 上线 ~ 2026-11-11 下线,站长令)的完整部署快照。
> 上游 = github.com/apollyon-sys/wardogs-calculator(MIT),部署版提交 9a6ff05f172f40(fix: marker ci)。
> 运维手册与全部踩坑记录 = 服务器 /root/docs/wardogs-deploy-plan/steps.md(文档保留未删)。

## 内容

- deploy/ — postbuild.mjs(13 处补丁:R2 URL 同源改写/关 collab·feedback/删 umami/三层反镜像验证禁用)、update.sh(周更管线)、update.log、nginx location 配置原文、cron 行
- dist/ — 最后在役构建产物(22M,含全部补丁)
- repo-snapshot/ — 上游源码快照(去 .git;完整 git 史在 upstream,钉 9a6ff05)
- r2-local/ — **自托管地图瓦片全量 65,535 张**(assets-v1 布局:bakurani/ozeti/zestafona 三图底图+色彩层+地形;来源=2026-10-21 Reddit r/WarDogs 社区高清原图经 cut-tiles.py LANCZOS+WebP q85 切片;初版 2026-10-20 系 Crecket fork git archive 提取。上游作者 CDN 禁镜像,自托管系政策合规路线)
- homepage-card/ — 下线前主页服务卡快照(index 含卡 HTML+wardogs-card.webp 背景图)

## 恢复指南(若将来重启该服务)

1. 服务器:mkdir /opt/services/wardogs;还原本仓 dist/ 与 r2-local/
2. nginx:按 deploy/nginx-wardogs-conf.txt 恢复 location 块(/wardogs/、/wardogs/r2/ alias)
3. cron:按 deploy/cron-line.txt 恢复周一行
4. 主页:从 homepage-card/ 取卡片 HTML 与背景图回植
5. 周更管线:deploy/update.sh(需 Docker;上游更新后 postbuild 三重校验防坏版)

## 版权注记

上游代码 MIT(含);瓦片=社区自游戏文件提取切片(游戏素材版权归 BULKHEAD/WARDOGS 作者,仅自用存档);cut-tiles.py 切片工具在 /root/docs/wardogs-deploy-plan/。
