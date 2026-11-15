# Aggregated Logs

View logs from multiple pods and containers in one stream, using the current user's Kite permissions.

- Open the standalone **Aggregated Logs** page from the sidebar. Mix Pods, Deployments, StatefulSets, DaemonSets, and Jobs across namespaces in one resource picker. Checking a resource immediately adds it; overlapping pods are deduplicated. There are no resource detail tabs.
- Workload membership refreshes every five seconds. New pods and restarted containers are followed automatically. The default container is selected for each pod; select all regular containers or choose init and ephemeral containers individually.
- Choose the last 100 lines per container, the last 5/15/60 minutes, new logs only, or the previous container instance. Completed containers are read as snapshots.
- Read the merged stream in Kite's shared Monaco LogViewerPanel, with stable colored namespace/pod/container prefixes and application ANSI colors. Filter received logs without discarding history; use Monaco Find (Cmd/Ctrl+F) for case-sensitive or regular expression search.
- Pause following while continuing to receive logs, wrap long lines, enter fullscreen, and download the visible text as TXT with namespace, pod, container, and instance information.

The session connects at most 20 readable container streams and retains at most 50,000 lines or 20 MiB of UTF-8 log text. Removing a resource stops its subscriptions unless another selected resource still includes those pods; already received history remains until cleared. Leaving the page closes all streams. Reloading or changing the time range starts a new log session. Logs are kept in browser memory only; no collectors or external logging services are installed.

History is limited by the Kubernetes Pod log API: rotated or deleted logs may no longer be available, and Previous refers only to the preceding container instance. Ordering is best effort using Kubernetes timestamps, not a guarantee of ordering across nodes. Network reconnection can replay recent history. This version does not include cross-cluster aggregation, log-level parsing, or a histogram.

## Development

Requires the accompanying Kite host/SDK changes: `LogViewerPanel` accepting `entries` with optional millisecond `timestamp`, `toolbar`, `status`, and `onClear`; the shared Popover components; and `follow`, `onStreamError`, and `onStreamEnd` in `useLogsWebSocket`. The plugin declares Kite `>=0.18.0`; use a development build containing those changes until they are released.

```sh
pnpm install
pnpm --filter @kite-dev/plugin-sdk build
pnpm --filter aggregated-logs build
pnpm --filter aggregated-logs run pack
```

For live development, run `pnpm --filter aggregated-logs dev` and start Kite with `PLUGIN_DEV_URL=http://localhost:5174/plugin.json`.

## 中文

在侧栏打开独立的「聚合日志」页面，在同一个选择器中混选 Pod、Deployment、StatefulSet、DaemonSet 或 Job。勾选即聚合，重叠 Pod 自动去重，不注册资源详情页标签。展示复用 Kite 共享 Monaco LogViewerPanel，保留彩色来源前缀、ANSI 颜色、可逆筛选、查找、自动跟随和 TXT 导出。

最多连接 20 个可读取的容器日志流，缓存最多 50,000 行或 20 MiB 日志文本。来源每 5 秒刷新一次；暂停跟随仍会接收日志，离开页面会关闭连接。切换时间范围或重新加载会清空本次日志。历史日志受 Kubernetes 的日志保留策略限制，断线重连可能重放近期日志。
