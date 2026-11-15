# PVC File Browser

Adds a **Files** tab to PVC detail pages in Kite. The plugin reuses the host's Pod file browser for directory listing, previews, downloads, and uploads.

- Finds containers mounting the PVC in its namespace, including running init and ephemeral containers. Select a Pod, container, and mount path; a running mount is selected initially.
- Opens the actual mount path, keeps directory navigation under that path, and hides uploads on read-only mounts. A `subPath` mount exposes only that mounted subtree.
- When the container cannot be used, create a browsing Pod from the tab. The default image is `busybox:1.37`; an alternative image must provide `sleep`, `ls --full-time`, `cat`, `tar`, `test`, and `tee`. The PVC is mounted at `/volume`.
- For ReadWriteOnce volumes with an existing scheduled consumer, the browsing Pod uses node affinity to stay on that node. ReadWriteOncePod volumes cannot get a second consumer while another Pod uses them. Block volumes are not supported. Pending PVCs can use a helper so that WaitForFirstConsumer binding can proceed through the scheduler.
- Helper Pods are created only after the user selects **Create browsing pod**. They have no service-account token and remain available across navigation and reloads. Use **Remove browsing pod** when finished; deleting the PVC also garbage-collects its helper. Cleanup does not delete the PVC or its data. Existing application Pods are never deleted or modified.

The plugin uses the current cluster and user permissions: reading Pods, executing file operations in Pods, and creating/deleting the helper Pod. Creation, scheduling, mount, image-pull, and file-list errors are shown in the tab. Helpers are not privileged; storage permissions and cluster admission policies still apply.

Requires Kite `>=0.18.0` with the accompanying `PodFileBrowser` and `DeleteConfirmationDialog` SDK exports. File navigation is a UI boundary, not filesystem isolation; existing Pod exec permissions continue to apply, including access through symbolic links.

## Development

```sh
pnpm install
pnpm --filter @kite-dev/plugin-sdk build
pnpm --filter pvc-file-browser build
pnpm --filter pvc-file-browser run pack
```

## 中文

在 PVC 详情页添加「文件」标签页，查找挂载它的 Pod、容器和挂载路径，复用 Kite 原生 Pod 文件浏览器。支持目录浏览、预览、下载和上传；只读挂载隐藏上传入口，`subPath` 挂载只展示对应子目录。

没有可用容器时，可创建浏览 Pod，把 PVC 挂载到 `/volume`。ReadWriteOnce 卷优先与现有使用者调度到同一节点；ReadWriteOncePod 已有使用者时不能再创建第二个挂载 Pod。块设备卷不提供文件浏览。临时 Pod 不会因切换页面而自动删除，使用完后请点击「删除浏览 Pod」；这不会删除 PVC 或文件。

默认镜像为 `busybox:1.37`，创建时可改用可拉取的镜像。镜像需具备文件操作命令；权限、镜像拉取、调度或挂载失败会在页面显示。需要包含本次宿主组件导出的 Kite `>=0.18.0`。
