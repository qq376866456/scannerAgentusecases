# 无服务器采集与部署

GitHub Actions 定时采集 → 去重、归类、可选中文翻译 → JSON/JS 数据快照 → GitHub Pages 静态网站。

没有常驻服务或数据库。页面加载已生成的数据，不会在访客浏览时向外站爬取。收藏和自建灵感仍保存在当前浏览器。

## 内容分层

- 网络新发现：自动从公开标题匹配智能体相关条目，展示原始链接、发布时间和首次采集时间。它们是待核验线索，可能包含工具发布、讨论或新闻。
- 编辑精选：原有 18 条内容，包含带出处的摘要和原创练习模板。
- `zh-titles.json` 保存首批条目的中文译题；后续英文标题没有翻译配置时保留原文。

## GitHub 上启用

1. 项目文件放在专用仓库的 `main` 分支根目录。
2. 仓库 `Settings → Pages → Build and deployment → Source` 选择 **GitHub Actions**。
3. 在 `Actions` 中运行 **采集与发布灵感库**，或推送一次代码触发。工作流需要内容写入权限，分支策略需允许机器人保存 `dist/data/`。
4. 首次部署成功后，访问 `https://<用户名>.github.io/<仓库名>/`。

工作流设为北京时间每天 **08:23** 运行，也支持手动运行。GitHub 调度可能延迟；公开仓库长期没有活动时，计划任务可能被禁用，需要在 Actions 中重新启用。页面展示实际成功采集时间，超过 36 小时会提示数据陈旧。

GitHub Pages/Actions 是否收费取决于仓库、账户和当前服务额度；本方案不需要购买云主机。公开仓库的源码、数据和 Pages 内容可被公开访问，不要把密钥或私人资料放入仓库。

## 可选：自动中文翻译

无需模型密钥即可采集。新增条目需要自动翻译时，在仓库 `Settings → Secrets and variables → Actions` 配置：

| 名称 | 位置 | 含义 |
| --- | --- | --- |
| `SUMMARY_API_KEY` | Secrets | 模型 API 密钥，不写入代码 |
| `SUMMARY_API_URL` | Variables | 支持 Chat Completions 格式的 HTTPS 完整请求地址 |
| `SUMMARY_MODEL` | Variables | 对应服务提供的模型标识 |

接口需支持 `messages`、`response_format: {"type":"json_object"}`，并返回 `choices[0].message.content`。不同厂商并不保证完全兼容，配置后需要运行一次验证。

每轮最多处理 20 个未翻译标题；已翻译且原标题未变的条目不会重复请求。只向模型发送公开标题和内部编号，不发送文章全文。翻译失败保留原文，日志不输出密钥与模型响应。模型服务可能计费。模型密钥不会进入 `dist/`。

## 本地运行

采集和测试要求 **Node.js 24+**。静态预览可使用现有 Node。

```bash
npm ci --ignore-scripts
npm test
npm run collect
npm start
```

访问 `http://127.0.0.1:8765`。采集命令会读取已有代理环境变量，不修改系统网络设置。默认 Node 太旧时请使用本机新版 Node 执行 `scripts/collect.mjs`。

可直接打开 `dist/index.html` 浏览已生成内容；`feed.js` 与 `feed.json` 同步生成，因此无需依赖本地文件的 fetch 支持。

## 数据规则

- HN：每次读取 Show HN、最新列表各最多 100 条，交叉去重后按标题关键词匹配；不是全站全量扫描。
- RSS：默认使用 Simon Willison 的 Atom 源，可在 `sources.json` 增加 RSS/Atom。只保存标题、链接和时间，不复制正文。
- URL 去掉常见跟踪参数后生成稳定编号；保留历史记录，默认最多 300 条、90 天。
- 单个来源失败时保留其既有内容并标记部分成功；全部失败时退出并保留原快照，不更新成功采集时间。
- 数据源可能改变或限流；没有匹配项不等于网络请求失败。
- 工具和场景标签来自关键词推断，自动收录不等于人工审核。

## 文件

| 路径 | 用途 |
| --- | --- |
| `dist/` | 可部署的网站，含编辑内容和网络快照 |
| `scripts/collect.mjs` | 采集、增量更新及可选翻译 |
| `scripts/lib.mjs` | XML 解析、去重、标签和校验 |
| `sources.json` | 来源、采集范围和保留规则 |
| `zh-titles.json` | 编辑整理的标题翻译 |
| `.github/workflows/refresh.yml` | GitHub 定时采集和部署 |
| `tests/collector.test.mjs` | 去重、旧数据保留、解析和翻译校验测试 |

GitHub 版本不依赖先前的 Sites 身份配置；不包含邮件订阅、账户系统或跨设备收藏同步。

## 官方参考

- [Hacker News API](https://github.com/HackerNews/API)
- [GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub Actions 定时事件](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
