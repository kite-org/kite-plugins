import { useState } from 'react'
import { useNamespace } from '@kite-dev/plugin-sdk/hooks'
import { applyResource } from '@kite-dev/plugin-sdk/resources'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  YamlEditor,
} from '@kite-dev/plugin-sdk/ui'

import { useTranslation } from '../i18n'
import { resources, type ResourceType } from '../resources'
import styles from '../style.module.css'

export function ApplyDialog({
  type,
  onClose,
  onApplied,
}: {
  type: ResourceType
  onClose: () => void
  onApplied: () => Promise<unknown>
}) {
  const { t } = useTranslation()
  const { namespace } = useNamespace()
  const [yaml, setYaml] = useState(
    () => `apiVersion: gateway.networking.k8s.io/v1
kind: ${resources[type].kind}
metadata:
  name: example-${type === 'gateways' ? 'gateway' : 'route'}
  namespace: ${JSON.stringify(namespace && namespace !== '_all' && !namespace.includes(',') ? namespace : 'default')}
spec:
${
  type === 'gateways'
    ? `  gatewayClassName: example-class
  listeners:
    - name: http
      protocol: HTTP
      port: 80
`
    : `  parentRefs:
    - name: example-gateway
  hostnames:
    - example.com
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: example-service
          port: 80
`
}`
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  async function apply() {
    setPending(true)
    setError(undefined)
    try {
      await applyResource(yaml)
      await onApplied()
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : t('apply.failed'))
    } finally {
      setPending(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) onClose()
      }}
    >
      <DialogContent className={styles.dialog} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {t('apply.title', { resource: t(resources[type].singular) })}
          </DialogTitle>
          <DialogDescription>{t('apply.description')}</DialogDescription>
        </DialogHeader>
        <YamlEditor
          value={yaml}
          onChange={(value) => setYaml(value ?? '')}
          disabled={pending}
          height="55vh"
        />
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            {t('actions.cancel')}
          </Button>
          <Button
            disabled={pending || !yaml.trim()}
            onClick={() => void apply()}
          >
            {t(pending ? 'actions.applying' : 'actions.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
