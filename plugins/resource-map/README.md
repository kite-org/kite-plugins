# Resource Map

Explore Kubernetes resource relationships in Kite. The plugin adds **Resource Map** to the **Application** sidebar group and uses the active cluster, namespace, theme, and language.

## Features

- Group resources by namespace or scheduled node. Lay out ownership and references together, with controllers on the left, Pods in the middle, and their dependencies on the right. Connections use separate attachment points and routing lanes between cards.
- Fold scaled-down ReplicaSets by controller and groups of five or more healthy Pods with zero restarts. Expand them or search to reveal each resource; unhealthy resources remain individual cards.
- Group Helm release Secrets by namespace and release name. Expand or search to access individual revisions; ordinary Secrets remain separate.
- View resource counts, ready replicas, Pod restarts and node placement, images, Service ports, Ingress hosts, and storage capacity directly on the map. Inspect additional fields in the details panel.
- Search names, kinds, and namespaces; filter resource categories or show only warnings and errors.
- Pan and zoom the graph, fit the entire map, and navigate with a minimap.
- Click a resource to open its status, recent events, and related resources in the details panel. Keyboard users can press Enter or Space on a focused resource.
- Open Kite's native resource details and Pod logs.
- Refresh automatically every 15 seconds or manually. Failed resource queries are reported without hiding resources that loaded successfully.
- English and Chinese translations, light and dark themes, and a stacked layout on narrow screens.

The map supports Pods, Deployments, ReplicaSets, StatefulSets, DaemonSets, Jobs, CronJobs, Services, Ingresses, ConfigMaps, Secrets, PVCs, PVs, and Nodes. Relationships come from owner references, Service selectors, Ingress backends and TLS references, Pod configuration and volume references, PVC bindings, and Pod scheduling. Edges represent declared relationships, not observed network traffic.

Node grouping follows resource relationships to scheduled Pods. Resources spanning several nodes appear under **Multiple nodes**; resources without a known node appear under **Unscheduled / unassigned**. Cross-group edges are shown whenever both endpoints are visible.

The initial view shows the resource overview without opening an inspector. Namespace and node groups start expanded; the cluster resource group starts collapsed alongside namespaces. The map refits after layout changes. Ownership uses gray solid lines; references use blue dashed lines. Ownership, routing, Service selectors, configuration, storage, and node references are connected whenever both endpoints are visible. Clicking a workload or Pod opens its details panel and highlights its ownership chain and upstream dependencies. Shared ConfigMaps, Secrets, Services, storage, and Nodes do not extend that highlight to other workloads. Selecting one of those dependencies highlights its actual consumers and their workload chains instead. Card styling, line paths, positions, and zoom remain unchanged; other resources are not faded. Clicking does not expand groups or reset filters. Closing the details panel or clicking the canvas clears the highlight. **Fit to view** returns to the complete visible graph. Counts include resources in collapsed groups, and the footer reports how many resources are folded into summaries. Long names and truncated values are available on hover and in the inspector.

## Requirements

- Kite 0.16.0 or later, with plugin SDK 0.0.6 support.
- Permission to list the resource types above; viewing events requires event access. Native details and logs retain Kite's existing permission checks.

The plugin uses the SDK's existing resource APIs and requires no additional backend. It only reads resource data. ConfigMap and Secret nodes show metadata, key counts, and Secret types; their values are not displayed in the map. Relationships are limited to resources available in the current scope and permissions. Custom resources and observed traffic are not included.

## Build and install

From the workspace root:

```sh
pnpm install
pnpm --filter 'resource-map...' run build
pnpm --filter resource-map run pack
```

Install `plugins/resource-map/resource-map-0.1.7.tar.gz` from **Plugin management → Install from file**.

## Development

```sh
pnpm --filter resource-map dev
```

Set Kite's `PLUGIN_DEV_URL` to the URL printed by the command. Refresh Kite after each rebuild. See the [SDK development guide](../../packages/plugin-sdk/README.md#developing-a-plugin) for address configuration.

The plugin uses React Flow for the canvas and ELK for resource placement and connector routing within groups. All resource loading, namespace selection, events, shared controls, and navigation integrate with Kite through the SDK.
