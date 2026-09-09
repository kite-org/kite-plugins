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
  Label,
  NamespaceSelector,
  YamlEditor,
} from '@kite-dev/plugin-sdk/ui'

import { useTranslation } from '../i18n'
import { resources, type ResourceType } from '../resources'
import styles from './apply-dialog.module.css'

interface ApplyDialogProps {
  type: ResourceType
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplied: () => Promise<unknown>
}

export function ApplyDialog(props: ApplyDialogProps) {
  return props.open ? <ApplyDialogContent key={props.type} {...props} /> : null
}

function ApplyDialogContent({
  type,
  onOpenChange,
  onApplied,
}: ApplyDialogProps) {
  const { t } = useTranslation()
  const { namespace: currentNamespace } = useNamespace()
  const definition = resources[type]
  const namespaced = definition.reference.scope !== 'Cluster'
  const [namespace, setNamespace] = useState(
    currentNamespace &&
      currentNamespace !== '_all' &&
      !currentNamespace.includes(',')
      ? currentNamespace
      : 'default'
  )
  const [yaml, setYaml] = useState(
    () => `apiVersion: cert-manager.io/v1
kind: ${definition.kind}
metadata:
  name: ${type === 'certificates' ? 'example-com' : 'example-issuer'}
${namespaced ? `  namespace: ${JSON.stringify(namespace)}\n` : ''}spec:
${
  type === 'certificates'
    ? `  secretName: example-com-tls
  dnsNames:
    - example.com
  issuerRef:
    name: example-issuer
    kind: Issuer
    group: cert-manager.io
`
    : '  selfSigned: {}\n'
}`
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const validNamespace =
    !namespaced ||
    (namespace !== '' && namespace !== '_all' && !namespace.includes(','))
  const canApply = validNamespace && yaml.trim() !== '' && !pending

  async function apply() {
    if (!canApply) return
    setPending(true)
    setError(undefined)
    try {
      await applyResource(yaml, namespaced ? namespace : undefined)
      await onApplied()
      onOpenChange(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('apply.failed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!pending) onOpenChange(open)
      }}
    >
      <DialogContent className={styles.dialog} showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {t('apply.title', { resource: t(definition.singular) })}
          </DialogTitle>
          <DialogDescription>{t('apply.description')}</DialogDescription>
        </DialogHeader>
        <div className={styles.body}>
          <fieldset className={styles.fields} disabled={pending}>
            {namespaced && (
              <div className={styles.field}>
                <Label>{t('fields.namespace')}</Label>
                <NamespaceSelector
                  selectedNamespace={namespace}
                  handleNamespaceChange={setNamespace}
                  showAll={false}
                  multiple={false}
                  modal
                />
                <p className={styles.hint}>{t('apply.namespaceHint')}</p>
              </div>
            )}
            <div className={styles.field}>
              <Label>{t('fields.yamlConfiguration')}</Label>
              {type !== 'certificates' && (
                <p className={styles.hint}>{t('apply.templateHint')}</p>
              )}
              <YamlEditor
                value={yaml}
                onChange={(value) => setYaml(value ?? '')}
                height="400px"
                disabled={pending}
              />
            </div>
          </fieldset>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {t('actions.cancel')}
          </Button>
          <Button disabled={!canApply} onClick={apply}>
            {pending ? t('actions.applying') : t('actions.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
