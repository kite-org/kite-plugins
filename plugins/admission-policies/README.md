# Admission Policies

See the admission control configured in a cluster in one table. The plugin adds **Admission Policies** to the **Security** sidebar group. It lists every ValidatingWebhookConfiguration, MutatingWebhookConfiguration, ValidatingAdmissionPolicy, ValidatingAdmissionPolicyBinding, MutatingAdmissionPolicy, and MutatingAdmissionPolicyBinding, which Kite otherwise shows as six separate lists.

## Features

- Filter by kind, search by name or kind, sort, and refresh automatically.
- Open each resource in Kite's native detail page.
- Kinds the cluster does not serve, such as MutatingAdmissionPolicy while its API is beta, are left out silently. Kinds that fail to load for other reasons, such as missing permissions, are named above the table, and the resources that did load stay visible.
- English and Chinese translations.

## Requirements

- Kite 0.16.0 or later.
- Kite permissions to read the admission resources above. Each kind is loaded separately, so a user who can read only some of them sees those.

The plugin only reads resources and requires no additional backend.

## Build locally

From the workspace root:

```sh
pnpm install
pnpm --filter 'admission-policies...' run build
pnpm --filter admission-policies run pack
```

The archive is written to `plugins/admission-policies/admission-policies-0.1.0.tar.gz`. Install it from **Plugin management → Install from file**.

## Development

```sh
pnpm --filter admission-policies dev
```

Set Kite's `PLUGIN_DEV_URL` to the URL printed by the command. Refresh Kite after each rebuild.
