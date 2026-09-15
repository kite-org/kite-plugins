import type { UseQueryResult } from '@tanstack/react-query'

export interface OverviewData {
  totalNodes: number
  readyNodes: number
  totalPods: number
  runningPods: number
  totalNamespaces: number
  totalServices: number
  prometheusEnabled: boolean
  resource: {
    cpu: { allocatable: number; requested: number; limited: number }
    memory: { allocatable: number; requested: number; limited: number }
  }
}

export interface UsageDataPoint {
  timestamp: string
  value: number
}

export interface ResourceUsageHistory {
  cpu: UsageDataPoint[]
  memory: UsageDataPoint[]
  networkIn: UsageDataPoint[]
  networkOut: UsageDataPoint[]
  diskRead: UsageDataPoint[]
  diskWrite: UsageDataPoint[]
}

export interface PodMetricsHistory {
  cpu: UsageDataPoint[]
  memory: UsageDataPoint[]
  networkIn?: UsageDataPoint[]
  networkOut?: UsageDataPoint[]
  diskRead?: UsageDataPoint[]
  diskWrite?: UsageDataPoint[]
  fallback?: boolean
}

export interface OverviewOptions {
  staleTime?: number
}

export interface ResourceUsageHistoryOptions {
  staleTime?: number
  instance?: string
  enabled?: boolean
}

export interface PodMetricsOptions {
  staleTime?: number
  container?: string
  refreshInterval?: number
  labelSelector?: string
}

export interface LogsWebSocketOptions {
  container?: string
  tailLines?: number
  timestamps?: boolean
  previous?: boolean
  sinceSeconds?: number
  enabled?: boolean
  labelSelector?: string
  onNewLog?: (log: string) => void
  onClear?: () => void
}

export interface LogsWebSocketResult {
  isLoading: boolean
  error: Error | null
  isConnected: boolean
  downloadSpeed: number
  refetch: () => void
  stopStreaming: () => void
  clearLogs: () => void
}

export let useOverview: (
  options?: OverviewOptions
) => UseQueryResult<OverviewData, Error>
export let useResourceUsageHistory: (
  duration: string,
  options?: ResourceUsageHistoryOptions
) => UseQueryResult<ResourceUsageHistory, Error>
export let usePodMetrics: (
  namespace: string,
  podName: string,
  duration: string,
  options?: PodMetricsOptions
) => UseQueryResult<PodMetricsHistory, Error>
export let useLogsWebSocket: (
  namespace: string,
  podName: string,
  options?: LogsWebSocketOptions
) => LogsWebSocketResult
