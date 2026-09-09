import type {
  ResourceMetadata,
  ResourceReference,
} from '@kite-dev/plugin-sdk/resources'

import type { TranslationKey } from './i18n'

export interface Condition {
  type: string
  status: 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  lastTransitionTime?: string
  observedGeneration?: number
}

export interface Metadata extends ResourceMetadata {
  generation?: number
  deletionTimestamp?: string
  ownerReferences?: {
    apiVersion: string
    kind: string
    name: string
    uid: string
    controller?: boolean
  }[]
}

interface ResourceBase {
  apiVersion: string
  metadata: Metadata
  status?: { conditions?: Condition[] }
}

export interface IssuerReference {
  name: string
  kind?: string
  group?: string
}

export interface Certificate extends ResourceBase {
  kind: 'Certificate'
  spec: {
    secretName: string
    issuerRef: IssuerReference
    commonName?: string
    literalSubject?: string
    subject?: Record<string, string[] | string>
    dnsNames?: string[]
    ipAddresses?: string[]
    uris?: string[]
    emailAddresses?: string[]
    duration?: string
    renewBefore?: string
    renewBeforePercentage?: number
    isCA?: boolean
    usages?: string[]
    revisionHistoryLimit?: number
    privateKey?: {
      algorithm?: string
      size?: number
      encoding?: string
      rotationPolicy?: string
    }
    keystores?: Record<
      string,
      {
        create: boolean
        profile?: string
        passwordSecretRef?: { name: string; key?: string }
      }
    >
  }
  status?: {
    conditions?: Condition[]
    notBefore?: string
    notAfter?: string
    renewalTime?: string
    revision?: number
    lastFailureTime?: string
    failedIssuanceAttempts?: number
    nextPrivateKeySecretName?: string
  }
}

export interface CertificateRequest extends ResourceBase {
  kind: 'CertificateRequest'
  spec: {
    issuerRef: IssuerReference
    request: string
    duration?: string
    isCA?: boolean
    usages?: string[]
    username?: string
    uid?: string
    groups?: string[]
  }
  status?: {
    conditions?: Condition[]
    failureTime?: string
    certificate?: string
    ca?: string
  }
}

export interface Solver {
  selector?: {
    dnsNames?: string[]
    dnsZones?: string[]
    matchLabels?: Record<string, string>
  }
  http01?: {
    ingress?: { ingressClassName?: string; class?: string; name?: string }
    gatewayHTTPRoute?: {
      parentRefs?: { name: string; namespace?: string; kind?: string }[]
    }
  }
  dns01?: Record<string, unknown>
}

interface IssuerSpec {
  acme?: {
    server: string
    email?: string
    privateKeySecretRef: { name: string; key?: string }
    preferredChain?: string
    disableAccountKeyGeneration?: boolean
    externalAccountBinding?: {
      keyID: string
      keySecretRef: { name: string; key?: string }
    }
    solvers?: Solver[]
  }
  ca?: {
    secretName: string
    crlDistributionPoints?: string[]
    ocspServers?: string[]
  }
  selfSigned?: { crlDistributionPoints?: string[] }
  vault?: {
    server: string
    path: string
    namespace?: string
    auth?: Record<string, unknown>
  }
  venafi?: {
    zone: string
    tpp?: { url: string; credentialsRef: { name: string } }
    cloud?: { url?: string; apiTokenSecretRef: { name: string } }
  }
}

export interface Issuer extends ResourceBase {
  kind: 'Issuer' | 'ClusterIssuer'
  spec: IssuerSpec
  status?: {
    conditions?: Condition[]
    acme?: { uri?: string; lastRegisteredEmail?: string }
  }
}

export interface Order extends ResourceBase {
  kind: 'Order'
  spec: {
    issuerRef: IssuerReference
    request: string
    commonName?: string
    dnsNames?: string[]
    duration?: string
  }
  status?: {
    conditions?: Condition[]
    state?: string
    reason?: string
    url?: string
    finalizeURL?: string
    failureTime?: string
    authorizations?: {
      url: string
      identifier: string
      wildcard?: boolean
      initialState: string
    }[]
  }
}

export interface Challenge extends ResourceBase {
  kind: 'Challenge'
  spec: {
    issuerRef: IssuerReference
    dnsName: string
    type: 'HTTP-01' | 'DNS-01'
    wildcard?: boolean
    url: string
    authorizationURL: string
    solver: Solver
  }
  status?: {
    conditions?: Condition[]
    state?: string
    reason?: string
    processing?: boolean
    presented?: boolean
  }
}

export type CertManagerResource =
  Certificate | CertificateRequest | Issuer | Order | Challenge
export type ResourceType =
  | 'certificates'
  | 'certificaterequests'
  | 'issuers'
  | 'clusterissuers'
  | 'orders'
  | 'challenges'

interface ResourceDefinition {
  kind: CertManagerResource['kind']
  label: TranslationKey
  singular: TranslationKey
  reference: ResourceReference
  detailRoute: string
  editable: boolean
}

export const resources: Record<ResourceType, ResourceDefinition> = {
  certificates: {
    kind: 'Certificate',
    label: 'resources.certificates',
    singular: 'resources.certificate',
    reference: { group: 'cert-manager.io', resource: 'certificates' },
    detailRoute: 'certificate',
    editable: true,
  },
  certificaterequests: {
    kind: 'CertificateRequest',
    label: 'resources.certificateRequests',
    singular: 'resources.certificateRequest',
    reference: { group: 'cert-manager.io', resource: 'certificaterequests' },
    detailRoute: 'certificate-request',
    editable: false,
  },
  issuers: {
    kind: 'Issuer',
    label: 'resources.issuers',
    singular: 'resources.issuer',
    reference: { group: 'cert-manager.io', resource: 'issuers' },
    detailRoute: 'issuer',
    editable: true,
  },
  clusterissuers: {
    kind: 'ClusterIssuer',
    label: 'resources.clusterIssuers',
    singular: 'resources.clusterIssuer',
    reference: {
      group: 'cert-manager.io',
      resource: 'clusterissuers',
      scope: 'Cluster',
    },
    detailRoute: 'cluster-issuer',
    editable: true,
  },
  orders: {
    kind: 'Order',
    label: 'resources.orders',
    singular: 'resources.order',
    reference: { group: 'acme.cert-manager.io', resource: 'orders' },
    detailRoute: 'order',
    editable: false,
  },
  challenges: {
    kind: 'Challenge',
    label: 'resources.challenges',
    singular: 'resources.challenge',
    reference: { group: 'acme.cert-manager.io', resource: 'challenges' },
    detailRoute: 'challenge',
    editable: false,
  },
}

export function getCondition(resource: CertManagerResource, type: string) {
  return resource.status?.conditions?.find(
    (condition) => condition.type === type
  )
}

export function isCurrentCondition(
  resource: CertManagerResource,
  condition: Condition
) {
  return (
    condition.observedGeneration === undefined ||
    resource.metadata.generation === undefined ||
    condition.observedGeneration >= resource.metadata.generation
  )
}

export function issuerType(issuer: Issuer): string {
  if (issuer.spec.acme) return 'ACME'
  if (issuer.spec.ca) return 'CA'
  if (issuer.spec.selfSigned) return 'SelfSigned'
  if (issuer.spec.vault) return 'Vault'
  if (issuer.spec.venafi) return 'Venafi'
  return '—'
}
