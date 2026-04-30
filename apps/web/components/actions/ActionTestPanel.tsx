'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog'
import { Button } from '@workspace/ui/components/button'
import { Input } from '@workspace/ui/components/input'
import { Label } from '@workspace/ui/components/label'
import { Badge } from '@workspace/ui/components/badge'
import { Textarea } from '@workspace/ui/components/textarea'
import type { ActionParameter } from '@/hooks/useActions'

export interface ActionTestResult {
  success: boolean
  responseData: unknown
  formattedResult: string | null
  error: string | null
  durationMs: number
  request?: {
    method: string
    url: string
    headers: Record<string, string>
    body?: unknown
  }
}

interface ActionTestPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actionName: string
  parameters: ActionParameter[]
  onRunTest: (parameters: Record<string, unknown>) => Promise<ActionTestResult>
}

function toInitialParams(parameters: ActionParameter[]): Record<string, string> {
  return Object.fromEntries(parameters.map((parameter) => [parameter.name, '']))
}

function toTypedValue(
  parameter: ActionParameter,
  rawValue: string
): string | number | boolean | null {
  const trimmed = rawValue.trim()
  if (!trimmed) return null

  if (parameter.type === 'number') {
    const parsed = Number(trimmed)
    return Number.isNaN(parsed) ? null : parsed
  }

  if (parameter.type === 'boolean') {
    if (trimmed.toLowerCase() === 'true') return true
    if (trimmed.toLowerCase() === 'false') return false
    return null
  }

  return trimmed
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function ActionTestPanel({
  open,
  onOpenChange,
  actionName,
  parameters,
  onRunTest,
}: ActionTestPanelProps) {
  const [parameterValues, setParameterValues] = useState<Record<string, string>>(
    toInitialParams(parameters)
  )
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<ActionTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setParameterValues(toInitialParams(parameters))
    setResult(null)
    setError(null)
  }, [open, parameters])

  const canRun = useMemo(() => {
    return parameters.every((parameter) => {
      if (!parameter.required) return true
      return (parameterValues[parameter.name] ?? '').trim().length > 0
    })
  }, [parameterValues, parameters])

  const run = async () => {
    setRunning(true)
    setError(null)
    setResult(null)

    try {
      const payload: Record<string, unknown> = {}

      for (const parameter of parameters) {
        const rawValue = parameterValues[parameter.name] ?? ''
        const typedValue = toTypedValue(parameter, rawValue)

        if (typedValue === null) {
          if (parameter.required) {
            throw new Error(`"${parameter.name}" is required and must be valid.`)
          }
          continue
        }

        if (
          parameter.type === 'enum' &&
          parameter.enumValues &&
          parameter.enumValues.length > 0 &&
          !parameter.enumValues.includes(String(typedValue))
        ) {
          throw new Error(
            `"${parameter.name}" must be one of: ${parameter.enumValues.join(', ')}`
          )
        }

        payload[parameter.name] = typedValue
      }

      const testResult = await onRunTest(payload)
      setResult(testResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Test Action: {actionName}</DialogTitle>
          <DialogDescription>
            Run a safe test with sample parameter values before using this action in
            live conversations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Test Parameters</h3>
            {parameters.length === 0 ? (
              <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                This action has no parameters. Click Run Test to execute immediately.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {parameters.map((parameter) => (
                  <div key={parameter.name} className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <span>{parameter.name}</span>
                      {parameter.required && (
                        <Badge variant="outline" className="h-4 text-[10px]">
                          Required
                        </Badge>
                      )}
                    </Label>
                    <Input
                      value={parameterValues[parameter.name] ?? ''}
                      onChange={(event) =>
                        setParameterValues((prev) => ({
                          ...prev,
                          [parameter.name]: event.target.value,
                        }))
                      }
                      placeholder={parameter.description}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Type: {parameter.type}
                      {parameter.type === 'enum' && parameter.enumValues?.length
                        ? ` (${parameter.enumValues.join(', ')})`
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && (
            <section className="space-y-3 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={result.success ? 'default' : 'destructive'}>
                  {result.success ? 'Success' : 'Failed'}
                </Badge>
                <Badge variant="outline">
                  Duration: {(result.durationMs / 1000).toFixed(2)}s
                </Badge>
              </div>

              {result.request && (
                <div className="space-y-1.5">
                  <Label>Request Sent</Label>
                  <Textarea
                    readOnly
                    value={prettyJson(result.request)}
                    className="min-h-[120px] font-mono text-xs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Response Received</Label>
                <Textarea
                  readOnly
                  value={prettyJson(result.responseData)}
                  className="min-h-[120px] font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Formatted Result</Label>
                <Textarea
                  readOnly
                  value={
                    result.formattedResult ??
                    result.error ??
                    'No formatted result available.'
                  }
                  className="min-h-[84px] text-sm"
                />
              </div>
            </section>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={running}>
              Close
            </Button>
            <Button onClick={run} disabled={running || !canRun}>
              {running ? 'Running...' : 'Run Test'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
