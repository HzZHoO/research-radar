# 多页面研究雷达

基于 [osmosfeed](https://github.com/osmoscraft/osmosfeed) 的个人研究收件箱。可同时配置多个研究方向，收集 arXiv 论文和技术博客，按可解释的关键词规则筛选。RSI 是初始示例方向。**不调用模型，不需要 API 密钥，也不使用本地模型。**


## 一个仓库，多个独立雷达

所有雷达共用程序，各自拥有配置、页面、更新时间、缓存及更新工作流：

| 雷达 | 页面 | 配置 | 手动更新 Action |
|---|---|---|---|
| RSI | /rsi-feed/ | config.json | Update RSI radar |
| Post-train Recipe | /rsi-feed/post-train-recipe/ | radars/post-train-recipe.json | Update Post-train Recipe radar |

每个页面顶部可切换雷达，其 settings.html 仅配置当前雷达。复制应用的 JSON 带有雷达标识，Apply research settings 自动选中对应配置。完整替换发生在该雷达内部，不会替换其他雷达。浏览器草稿和已读状态也按页面隔离。

Post-train Recipe 默认跟踪配方与框架、数据构造与清洗、Thinking 数据与训练。信源包括 arXiv、Hugging Face、NVIDIA Developer，以及 TRL、verl、OpenRLHF、Open Instruct 的 GitHub Releases Atom。代码／参数／数据／Thinking 标签是原文线索，不保证提供完整可复现配方。页面另有固定入门项目链接，不冒充最新抓取结果。

更新流程只抓取被选中的雷达，并恢复其他页面的已发布输出，合并后部署。radar-published 分支保存网站快照；发布流程共享并发锁，避免互相覆盖。请在 main 分支编辑源码与配置；快照分支由程序管理。

本地构建整个站点：

```sh
# 默认更新 RSI；首次缺少的其他雷达也会建立
node scripts/build-site.mjs
# 更新后训练雷达（PowerShell）
$env:RADAR_PROFILE='post-train-recipe'
node scripts/build-site.mjs
```

新增第三个雷达不需要新仓库：添加一份配置，在 radars.json 登记 ID、路径和更新工作流，复制一个更新 workflow 并修改 RADAR_PROFILE、配置 paths 和报告路径即可。若要在配置留空时手动同步它，也可添加到 Apply research settings 的 radar 选项。

## 使用

需要 Node.js 22+。Windows 使用系统 curl；GitHub Actions 使用 Node fetch，失败时回退到 curl。

```sh
npm ci
npm test
npm run build
npm run preview
```

预览地址为 http://127.0.0.1:8787。页面默认显示最近 7 天，可按研究方向、信源、时间、论文／博客、相关程度筛选，搜索摘要，或隐藏已读。已读标记仅存储在当前浏览器。

已经抓取过时，可使用 `npm run build -- --offline` 重新生成页面，不访问外部来源。

## 修改兴趣和来源

- 推荐在网页打开 **研究方向与订阅设置**，增删方向、关键词、信源，调整更新时间与回溯天数。提供 Agent 记忆、模型训练与后训练、推理与强化学习、RSI 模板。
- 点击 **复制配置并前往 GitHub 应用**，在 GitHub 点击 **Run workflow**，将配置粘贴到 `config_json` 输入框并运行。当前账号需为仓库所有者。配置校验后写入仓库并自动重建；浏览器草稿不等于线上保存。
- 可以导入／导出 `config.json`，也可以直接在 GitHub 编辑这个文件。直接修改后同样自动应用并重建。
- `config.json` 是研究方向、来源、时区、更新时间和历史保留的统一配置；`osmosfeed.yaml` 仅为 osmosfeed 渲染使用。

不单独匹配 RSI 缩写，避免股票指标或重复性劳损等误报。匹配前统一大小写、连字符与变音符号。直接主题词命中分组为“直接相关”；相关方法词还需 AI 语境才保留。标题命中权重更高。分数只表示词语相关性，不代表研究质量。

arXiv 按每个启用方向的核心和扩展关键词生成独立搜索，可配置分类和结果上限，不是穷尽历史检索。API 不可用时回退到分类 RSS，页面会显示覆盖退化。Hugging Face RSS 没有摘要，首次补充最多 40 篇文章的正文文本（优先关注方向相关标题，再补最新 20 篇），后续复用缓存。RSS 仅保留部分历史，零命中不等于来源没有相关研究。

## 自动更新与发布

仓库公开后，在 Settings → Pages → Source 选择 **GitHub Actions**。默认北京时间 01:23、09:23、17:23 更新，可在设置页调整。调度器每 15 分钟执行一次轻量检查，仅在设定时刻后的检查窗口抓取与重建（例如 09:23 对应 09:30 的窗口）。其余检查跳过抓取；不需要为修改时间增加个人访问令牌。Actions → Update RSI radar → Run workflow 可以随时手动抓取。

GitHub Actions 是定时批处理，任务可能延迟；公开仓库长期没有活动时定时任务可能被暂停。标准公开仓库 runner 无模型调用费用。站点和研究兴趣配置是公开的。

运行状态通过 Actions cache 保存，文章按 arXiv ID（忽略版本号）或规范 URL 去重，默认保留 120 天，可调整到 1–365 天。每篇文章可以归属多个研究方向而不重复展示；各方向的分类独立计算。缓存保留未命中条目，以便修改主题后重新筛选。缓存被平台清理后会重新收集当前来源能提供的内容，已读标记仍在你的浏览器。

输出 `public/index.html`、`public/feed.atom`、`public/radar.json`、`public/report.md`。单个来源失败时保留旧结果并标记失败；所有来源失败则使工作流失败，避免把抓取失败误当成没有新研究。

## 实现

`collect.mjs` 下载和解析来源，`rank.mjs` 负责主题筛选。`build.mjs` 将结果写入 osmosfeed 的 enriched cache，提供空的本地 RSS 端点让 osmosfeed 使用已有条目渲染，避免它逐篇访问外部网页。使用 osmosfeed 自定义模板生成页面及 Atom 订阅。原文内容以纯文本转义展示；不生成或翻译摘要。

MIT 许可；模板来源为 osmoscraft/osmosfeed-template。
