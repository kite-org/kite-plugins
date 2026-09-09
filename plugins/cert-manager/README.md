# cert-manager for Kite

Manage cert-manager resources from Kite. The plugin adds a dedicated **cert-manager** sidebar group with resource lists, issuance details, YAML views, events, and links between related resources. It uses Kite's current cluster, namespace selection, language, and appearance settings.

## Requirements

- A Kite installation matching `^0.16.0` with access to the target cluster.
- cert-manager and its CustomResourceDefinitions installed in that cluster. See the [cert-manager installation guide](https://cert-manager.io/docs/installation/).
- Permission to view the relevant resources in Kite. Creating, updating, and deleting resources require the corresponding permissions for the selected cluster and namespace. Kite's cluster credentials must also allow those operations in Kubernetes.

The plugin reads resources in the `cert-manager.io` and `acme.cert-manager.io` API groups. Viewing events and opening linked Secrets also require access to those resources. ClusterIssuer pages use cluster scope; other pages use namespace scope.

## Install

A Kite administrator can install the plugin from **Avatar → Plugin management**:

1. Open **Plugin catalog** and select **cert-manager** from a configured catalog that provides it.
2. Install the plugin and confirm that it is enabled under **Installed plugins**.
3. Select a cluster and open the **cert-manager** sidebar group.

For a downloaded or locally built package, use **Install from file** and select `cert-manager-<version>.tar.gz`.

Updates are installed through Plugin management. Use **Installed plugins** to enable, disable, or remove the plugin.

## Resource pages

| Page                 | Information                                                                                                                                                |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Certificates         | Readiness and issuance status, DNS names, issuer and Secret references, validity dates, scheduled renewal, subject, usages, and private key configuration. |
| Certificate Requests | Readiness, approval and denial conditions, requester identity, issuer, revision, requested duration, and failure information.                              |
| Issuers              | Readiness and configuration for ACME, CA, SelfSigned, Vault, and Venafi issuers.                                                                           |
| Cluster Issuers      | Cluster-scoped issuer configuration and references to certificates and requests across namespaces.                                                         |
| Orders               | ACME state, requested domains, authorization details, order URLs, and failure reasons.                                                                     |
| Challenges           | HTTP-01 or DNS-01 validation state, domain, solver configuration, processing and presentation status, and failure reasons.                                 |

Lists support search, sorting, pagination, manual refresh, and an optional refresh interval. Namespaced resources follow Kite's namespace selector. Search includes names, namespaces, labels, and relevant fields such as DNS names, issuer names, Secret names, or requester identity.

Each detail page includes:

- **Overview:** metadata, resource-specific fields, and reported status conditions where applicable.
- **Related resources:** owner references and issuance relationships. Certificates link to their requests, requests to their orders, and orders to their challenges. Issuers show certificates and requests that reference them.
- **YAML:** the resource definition, with editing available for Certificates, Issuers, and ClusterIssuers.
- **Events:** Kubernetes events for that resource.

Secret references on namespaced resources link to Kite's Secret pages. ClusterIssuer Secret references are displayed by name because their namespace is determined by cert-manager's cluster resource namespace configuration.

## Create and manage resources

Certificates, Issuers, and ClusterIssuers provide a **Create** action and an **Apply YAML** action in the empty state. The dialog starts with a template:

- Certificates use an example DNS name, destination Secret, and Issuer reference.
- Issuers and ClusterIssuers use a SelfSigned configuration that you can replace with another issuer configuration.

Edit the template before applying it. For namespaced resources, the namespace selected in the dialog overrides `metadata.namespace` in the YAML. Applying a resource with an existing name updates it.

Certificates, Issuers, and ClusterIssuers can also be edited from the detail page's YAML tab. CertificateRequests, Orders, and Challenges provide read-only YAML. All six resource types offer deletion from their detail pages, subject to resource permissions.

Certificate renewal times and request approval conditions are displayed as reported by cert-manager. The plugin's actions are YAML apply, YAML edit, and resource deletion.

## Development

The plugin is a package in the `kite-plugins` pnpm workspace. Use Node.js `^20.19.0` or `>=22.12.0` and the pnpm version specified by the workspace's `packageManager` field.

The plugin uses `@kite-dev/plugin-sdk@0.0.4` from npm. Install dependencies from the `kite-plugins` repository root:

```sh
pnpm install
```

Run the plugin's checks, build, and packaging commands from the same directory:

```sh
pnpm --filter cert-manager type-check
pnpm --filter cert-manager build
pnpm --filter cert-manager run pack
```

The build writes `plugins/cert-manager/dist/`. Packaging creates `plugins/cert-manager/cert-manager-<version>.tar.gz`, using the version in the plugin's `package.json`. The package includes this README.

To rebuild when source files change:

```sh
pnpm --filter cert-manager dev
```

The watch command rebuilds the plugin output. Restart it after changing the plugin ID or version. To install a changed build, update the version in `package.json`, build and pack again, then install the new package in Kite. For serving packages through a local catalog, see the [workspace README](../../README.md).

The main source files are:

| File                              | Purpose                                               |
| --------------------------------- | ----------------------------------------------------- |
| `plugin.config.tsx`               | Route elements, page titles, and sidebar menus.       |
| `src/resources.ts`                | Resource references, types, and supported operations. |
| `src/pages/resource-list.tsx`     | List columns, filters, and creation entry points.     |
| `src/pages/resource-detail.tsx`   | Resource details, YAML editing, and events.           |
| `src/components/apply-dialog.tsx` | YAML templates and apply dialog.                      |
| `src/components/relations.tsx`    | Resource relationships.                               |

## License

Apache-2.0.
