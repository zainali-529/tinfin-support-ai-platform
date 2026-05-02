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
import { Textarea } from '@workspace/ui/components/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select'
import { Switch } from '@workspace/ui/components/switch'
import { Separator } from '@workspace/ui/components/separator'
import { Slider } from '@workspace/ui/components/slider'
import { LockIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { cn } from '@workspace/ui/lib/utils'
import type { ActionConfig, ActionParameter } from '@/hooks/useActions'

interface HeaderPair {
  key: string
  value: string
}

interface ActionDraft {
  name: string
  displayName: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  urlTemplate: string
  headers: HeaderPair[]
  bodyTemplate: string
  responsePath: string
  responseTemplate: string
  parameters: ActionParameter[]
  requiresConfirmation: boolean
  humanApprovalRequired: boolean
  timeoutSeconds: number
  isActive: boolean
  category: 'ecommerce' | 'scheduling' | 'account' | 'custom'
}

const DEFAULT_DRAFT: ActionDraft = {
  name: '',
  displayName: '',
  description: '',
  method: 'GET',
  urlTemplate: '',
  headers: [],
  bodyTemplate: '',
  responsePath: '',
  responseTemplate: '',
  parameters: [],
  requiresConfirmation: false,
  humanApprovalRequired: false,
  timeoutSeconds: 10,
  isActive: true,
  category: 'custom',
}

const EMPTY_HEADER: HeaderPair = {
  key: '',
  value: '',
}

const EMPTY_PARAMETER: ActionParameter = {
  name: '',
  type: 'string',
  description: '',
  required: true,
  enumValues: [],
}

function ensureHeader(header: HeaderPair | undefined): HeaderPair {
  return header ?? EMPTY_HEADER
}

function ensureParameter(parameter: ActionParameter | undefined): ActionParameter {
  return parameter ?? EMPTY_PARAMETER
}

function toSnakeCase(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function toTemplateIdentifier(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, '')
    .replace(/^[^a-zA-Z]+/g, '')
}

function fromAction(action: ActionConfig): ActionDraft {
  return {
    name: action.name,
    displayName: action.displayName,
    description: action.description,
    method: action.method,
    urlTemplate: action.urlTemplate,
    headers: Object.entries(action.headersTemplate ?? {}).map(([key, value]) => ({
      key,
      value,
    })),
    bodyTemplate: action.bodyTemplate ?? '',
    responsePath: action.responsePath ?? '',
    responseTemplate: action.responseTemplate ?? '',
    parameters: action.parameters ?? [],
    requiresConfirmation: action.requiresConfirmation,
    humanApprovalRequired: action.humanApprovalRequired,
    timeoutSeconds: action.timeoutSeconds,
    isActive: action.isActive,
    category: action.category,
  }
}

export interface ActionBuilderPayload {
  name: string
  displayName: string
  description: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  urlTemplate: string
  headersTemplate: Record<string, string>
  bodyTemplate: string | null
  responsePath: string | null
  responseTemplate: string | null
  parameters: ActionParameter[]
  requiresConfirmation: boolean
  humanApprovalRequired: boolean
  timeoutSeconds: number
  isActive: boolean
  category: 'ecommerce' | 'scheduling' | 'account' | 'custom'
}

interface ActionBuilderProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialAction?: ActionConfig | null
  loading?: boolean
  onSave: (payload: ActionBuilderPayload) => Promise<void> | void
  onTest?: (payload: ActionBuilderPayload) => void
}

export function ActionBuilder({
  open,
  onOpenChange,
  initialAction,
  loading = false,
  onSave,
  onTest,
}: ActionBuilderProps) {
  const [draft, setDraft] = useState<ActionDraft>(DEFAULT_DRAFT)
  const [nameTouched, setNameTouched] = useState(false)
  const [attemptedSave, setAttemptedSave] = useState(false)

  useEffect(() => {
    if (!open) return

    const next = initialAction ? fromAction(initialAction) : DEFAULT_DRAFT
    setDraft(next)
    setNameTouched(Boolean(initialAction?.name))
    setAttemptedSave(false)
  }, [open, initialAction])

  const parameterErrors = useMemo(() => {
    return draft.parameters.map((parameter) => {
      const errors: string[] = []
      if (!parameter.name.trim()) {
        errors.push('Parameter name is required.')
      }
      if (!parameter.description.trim()) {
        errors.push('Parameter description is required.')
      }
      return errors
    })
  }, [draft.parameters])

  const hasParameterErrors = useMemo(() => {
    return parameterErrors.some((errors) => errors.length > 0)
  }, [parameterErrors])

  useEffect(() => {
    if (!nameTouched) {
      setDraft((prev) => ({
        ...prev,
        name: toSnakeCase(prev.displayName),
      }))
    }
  }, [draft.displayName, nameTouched])

  const canSave = useMemo(() => {
    return (
      draft.name.trim().length > 0 &&
      draft.displayName.trim().length > 0 &&
      draft.description.trim().length > 0 &&
      draft.urlTemplate.trim().length > 0 &&
      !hasParameterErrors
    )
  }, [draft, hasParameterErrors])

  const payload: ActionBuilderPayload = {
    name: draft.name,
    displayName: draft.displayName,
    description: draft.description,
    method: draft.method,
    urlTemplate: draft.urlTemplate,
    headersTemplate: Object.fromEntries(
      draft.headers
        .filter((header) => header.key.trim().length > 0)
        .map((header) => [header.key.trim(), header.value])
    ),
    bodyTemplate: draft.bodyTemplate.trim() ? draft.bodyTemplate : null,
    responsePath: draft.responsePath.trim() ? draft.responsePath : null,
    responseTemplate: draft.responseTemplate.trim() ? draft.responseTemplate : null,
    parameters: draft.parameters,
    requiresConfirmation: draft.requiresConfirmation,
    humanApprovalRequired: draft.humanApprovalRequired,
    timeoutSeconds: draft.timeoutSeconds,
    isActive: draft.isActive,
    category: draft.category,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {initialAction ? 'Edit AI Action' : 'Create AI Action'}
          </DialogTitle>
          <DialogDescription>
            Configure an API action the AI can execute during customer conversations.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Basic Info</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={draft.displayName}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      displayName: event.target.value,
                    }))
                  }
                  placeholder="Get Order Status"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="name">Name (snake_case)</Label>
                <Input
                  id="name"
                  value={draft.name}
                  onChange={(event) => {
                    setNameTouched(true)
                    setDraft((prev) => ({
                      ...prev,
                      name: toSnakeCase(event.target.value),
                    }))
                  }}
                  placeholder="get_order_status"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={draft.category}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      category: value as ActionDraft['category'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ecommerce">E-commerce</SelectItem>
                    <SelectItem value="scheduling">Scheduling</SelectItem>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="description">
                  Description (AI reads this to decide when to use)
                </Label>
                <Textarea
                  id="description"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Looks up real-time order status by order ID"
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3 md:col-span-2">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">
                    Inactive actions are hidden from the AI.
                  </p>
                </div>
                <Switch
                  checked={draft.isActive}
                  onCheckedChange={(checked) =>
                    setDraft((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">API Configuration</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Method</Label>
                <Select
                  value={draft.method}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      method: value as ActionDraft['method'],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label>URL Template</Label>
                <Input
                  value={draft.urlTemplate}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      urlTemplate: event.target.value,
                    }))
                  }
                  placeholder="https://api.yoursite.com/orders/{orderId}"
                />
                <p className="text-xs text-muted-foreground">
                  Use {'{variableName}'} placeholders for dynamic values.
                </p>
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between">
                  <Label>Headers</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        headers: [...prev.headers, { key: '', value: '' }],
                      }))
                    }
                  >
                    <PlusIcon className="mr-1 size-3.5" />
                    Add Header
                  </Button>
                </div>

                <div className="space-y-2">
                  {draft.headers.map((header, index) => (
                    <div key={index} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <Input
                        value={header.key}
                        onChange={(event) =>
                          setDraft((prev) => {
                            const next = [...prev.headers]
                            next[index] = {
                              ...ensureHeader(next[index]),
                              key: event.target.value,
                            }
                            return { ...prev, headers: next }
                          })
                        }
                        placeholder="Authorization"
                      />
                      <div className="relative">
                        <Input
                          value={header.value}
                          onChange={(event) =>
                            setDraft((prev) => {
                              const next = [...prev.headers]
                              next[index] = {
                                ...ensureHeader(next[index]),
                                value: event.target.value,
                              }
                              return { ...prev, headers: next }
                            })
                          }
                          placeholder="Bearer {apiKey}"
                          className="pr-8"
                        />
                        {/\{[a-zA-Z0-9_]+\}/.test(header.value) && (
                          <LockIcon className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            headers: prev.headers.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2Icon className="size-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {['POST', 'PUT', 'PATCH'].includes(draft.method) && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label>Request Body</Label>
                  <Textarea
                    value={draft.bodyTemplate}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        bodyTemplate: event.target.value,
                      }))
                    }
                    placeholder='{"orderId":"{orderId}"}'
                    rows={5}
                  />
                </div>
              )}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Parameters</h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    parameters: [
                      ...prev.parameters,
                      {
                        name: '',
                        type: 'string',
                        description: '',
                        required: true,
                        enumValues: [],
                      },
                    ],
                  }))
                }
              >
                <PlusIcon className="mr-1 size-3.5" />
                Add Parameter
              </Button>
            </div>

            <div className="space-y-3">
              {draft.parameters.map((parameter, index) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      className={cn(
                        attemptedSave &&
                          parameterErrors[index]?.some((error) =>
                            error.toLowerCase().includes('name')
                          ) &&
                          'border-destructive focus-visible:ring-destructive/40'
                      )}
                      value={parameter.name}
                      onChange={(event) =>
                        setDraft((prev) => {
                          const next = [...prev.parameters]
                          next[index] = {
                            ...ensureParameter(next[index]),
                            name: toTemplateIdentifier(event.target.value),
                          }
                          return { ...prev, parameters: next }
                        })
                      }
                      placeholder="orderId"
                    />

                    <Select
                      value={parameter.type}
                      onValueChange={(value) =>
                        setDraft((prev) => {
                          const next = [...prev.parameters]
                          next[index] = {
                            ...ensureParameter(next[index]),
                            type: value as ActionParameter['type'],
                          }
                          return { ...prev, parameters: next }
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="enum">Enum</SelectItem>
                      </SelectContent>
                    </Select>

                    <Textarea
                      className={cn(
                        'md:col-span-2',
                        attemptedSave &&
                          parameterErrors[index]?.some((error) =>
                            error.toLowerCase().includes('description')
                          ) &&
                          'border-destructive focus-visible:ring-destructive/40'
                      )}
                      value={parameter.description}
                      onChange={(event) =>
                        setDraft((prev) => {
                          const next = [...prev.parameters]
                          next[index] = {
                            ...ensureParameter(next[index]),
                            description: event.target.value,
                          }
                          return { ...prev, parameters: next }
                        })
                      }
                      placeholder="How AI should extract this parameter"
                      rows={2}
                    />
                    {attemptedSave && (parameterErrors[index]?.length ?? 0) > 0 && (
                      <p className="md:col-span-2 text-xs text-destructive">
                        {(parameterErrors[index] ?? []).join(' ')}
                      </p>
                    )}

                    <Input
                      value={parameter.enumValues?.join(', ') ?? ''}
                      onChange={(event) =>
                        setDraft((prev) => {
                          const next = [...prev.parameters]
                          next[index] = {
                            ...ensureParameter(next[index]),
                            enumValues: event.target.value
                              .split(',')
                              .map((item) => item.trim())
                              .filter(Boolean),
                          }
                          return { ...prev, parameters: next }
                        })
                      }
                      placeholder="Enum values (comma separated)"
                      disabled={parameter.type !== 'enum'}
                    />

                    <div className="flex items-center justify-between rounded-md border px-3">
                      <span className="text-sm">Required</span>
                      <Switch
                        checked={parameter.required}
                        onCheckedChange={(checked) =>
                          setDraft((prev) => {
                            const next = [...prev.parameters]
                            next[index] = {
                              ...ensureParameter(next[index]),
                              required: checked,
                            }
                            return { ...prev, parameters: next }
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          parameters: prev.parameters.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <Trash2Icon className="mr-1 size-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Behavior</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Require customer confirmation</p>
                  <p className="text-xs text-muted-foreground">
                    AI asks before executing this action.
                  </p>
                </div>
                <Switch
                  checked={draft.requiresConfirmation}
                  onCheckedChange={(checked) =>
                    setDraft((prev) => ({
                      ...prev,
                      requiresConfirmation: checked,
                    }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Require agent approval</p>
                  <p className="text-xs text-muted-foreground">
                    Action is queued until an agent approves.
                  </p>
                </div>
                <Switch
                  checked={draft.humanApprovalRequired}
                  onCheckedChange={(checked) =>
                    setDraft((prev) => ({
                      ...prev,
                      humanApprovalRequired: checked,
                    }))
                  }
                />
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-medium">Timeout</p>
                  <p className="text-xs text-muted-foreground">
                    {draft.timeoutSeconds}s
                  </p>
                </div>
                <Slider
                  min={5}
                  max={60}
                  step={1}
                  value={[draft.timeoutSeconds]}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      timeoutSeconds: value[0] ?? 10,
                    }))
                  }
                />
              </div>
            </div>
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Response Formatting</h3>
            <div className="grid gap-3">
              <div className="space-y-1.5">
                <Label>Response Path</Label>
                <Input
                  value={draft.responsePath}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      responsePath: event.target.value,
                    }))
                  }
                  placeholder="data.order.status"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Response Template</Label>
                <Textarea
                  value={draft.responseTemplate}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      responseTemplate: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Order status: {status}, ETA: {eta}"
                />
              </div>
            </div>
          </section>

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onTest?.(payload)}
              disabled={!onTest || !canSave}
            >
              Test Action
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!canSave || loading}
                onClick={async () => {
                  setAttemptedSave(true)
                  if (!canSave) return
                  await onSave(payload)
                  onOpenChange(false)
                }}
              >
                {loading ? 'Saving...' : 'Save Action'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
