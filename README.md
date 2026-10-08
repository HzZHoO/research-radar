# RSI 研究雷达

基于 [osmosfeed](https://github.com/osmoscraft/osmosfeed) 的个人研究收件箱。收集 arXiv 论文、Hugging Face Blog、NVIDIA 技术博客与 Lil’Log，按可解释的关键词规则筛选。**不调用模型，不需要 API 密钥，也不使用本地模型。**

## 使用

需要 Node.js 22+。Windows 使用系统 curl；GitHub Actions 使用 Node fetch，失败时回退到 curl。

```sh
npm ci
npm test
npm run build
npm run preview
```

预览地址为 http://127.0.0.1:8787。页面默认显示最近 7 天，可切换到全部回溯、论文／博客、直接相关／相关方法，搜索摘要，或隐藏已读。已读标记仅存储在当前浏览器。

已经抓取过时，可使用 `npm run build -- --offline` 重新生成页面，不访问外部来源。

## 修改兴趣和来源

- `topics.json`：明确的主题词、相关方法词、AI 语境词、排除词、历史保留天数。
- `feeds.json`：订阅 URL、来源名称、论文／博客类型、备用订阅。
- `osmosfeed.yaml`：站点名称和时区。

不单独匹配 RSI 缩写，避免股票指标或重复性劳损等误报。匹配前统一大小写、连字符与变音符号。直接主题词命中分组为“直接相关”；相关方法词还需 AI 语境才保留。标题命中权重更高。分数只表示词语相关性，不代表研究质量。

arXiv API 查询有结果条数上限（100 / 80），不是穷尽历史检索。API 不可用时回退到分类 RSS，页面会显示覆盖退化。Hugging Face RSS 没有摘要，首次补充最多 40 篇文章的正文文本（优先相关标题，再补最新 20 篇），后续复用缓存。RSS 仅保留部分历史，零命中不等于来源没有相关研究。

## 自动更新与发布

仓库公开后，在 Settings → Pages → Source 选择 **GitHub Actions**。工作流默认北京时间 09:23、17:23、次日 01:23 更新，也支持 Actions → Update RSI radar → Run workflow 手动触发。

GitHub Actions 是定时批处理，任务可能延迟；公开仓库长期没有活动时定时任务可能被暂停。标准公开仓库 runner 无模型调用费用。站点和研究兴趣配置是公开的。

运行状态通过 Actions cache 保存，文章按 arXiv ID（忽略版本号）或规范 URL 去重，最多保留 120 天。缓存被平台清理后会重新收集当前来源能提供的内容，已读标记仍在你的浏览器。

输出 `public/index.html`、`public/feed.atom`、`public/radar.json`、`public/report.md`。单个来源失败时保留旧结果并标记失败；所有来源失败则使工作流失败，避免把抓取失败误当成没有新研究。

## 实现

`collect.mjs` 下载和解析来源，`rank.mjs` 负责主题筛选。`build.mjs` 将结果写入 osmosfeed 的 enriched cache，提供空的本地 RSS 端点让 osmosfeed 使用已有条目渲染，避免它逐篇访问外部网页。使用 osmosfeed 自定义模板生成页面及 Atom 订阅。原文内容以纯文本转义展示；不生成或翻译摘要。

MIT 许可；模板来源为 osmoscraft/osmosfeed-template。
