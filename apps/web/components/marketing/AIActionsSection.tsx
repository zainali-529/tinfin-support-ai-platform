"use client"

import DottedMap from "dotted-map"
import {
  ActivityIcon,
  CheckCircle2Icon,
  Globe2Icon,
  KeyRoundIcon,
  LockKeyholeIcon,
  PlayCircleIcon,
} from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip,
  XAxis,
} from "recharts"

import { ChartContainer, type ChartConfig } from "@workspace/ui/components/chart"

const ACTION_EVENTS = [
  { label: "Parameter check", status: "required", value: "orderId" },
  { label: "Execution preview", status: "ready", value: "GET /orders/{id}" },
  { label: "Approval gate", status: "protected", value: "write actions" },
] as const

const CHART_DATA = [
  { day: "Mon", success: 18, approvals: 4 },
  { day: "Tue", success: 26, approvals: 5 },
  { day: "Wed", success: 24, approvals: 7 },
  { day: "Thu", success: 34, approvals: 8 },
  { day: "Fri", success: 31, approvals: 6 },
  { day: "Sat", success: 42, approvals: 10 },
  { day: "Sun", success: 38, approvals: 9 },
  { day: "Mon", success: 48, approvals: 11 },
  { day: "Tue", success: 44, approvals: 8 },
  { day: "Wed", success: 56, approvals: 13 },
  { day: "Thu", success: 52, approvals: 12 },
] as const

const chartConfig = {
  success: {
    label: "Successful actions",
    color: "var(--primary)",
  },
  approvals: {
    label: "Approvals",
    color: "#f59e0b",
  },
} satisfies ChartConfig

const actionMap = new DottedMap({ height: 55, grid: "diagonal" })
const mapPoints = actionMap.getPoints()

const svgOptions = {
  backgroundColor: "var(--background)",
  color: "currentColor",
  radius: 0.15,
}

export function AIActionsSection() {
  return (
    <section id="ai-actions" className="bg-background px-4 py-20 md:py-24">
      <div className="mx-auto grid max-w-[86rem] border border-border md:grid-cols-2">
        <div>
          <div className="p-6 sm:p-10 lg:p-12">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe2Icon className="size-4" />
              API endpoint actions
            </span>

            <p className="mt-8 max-w-xl text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              Let AI read approved systems through safe API actions, with every request visible before it runs.
            </p>
          </div>

          <EndpointMapPreview />
        </div>

        <div className="overflow-hidden border-t border-border bg-muted/20 p-6 md:border-l md:border-t-0 sm:p-10 lg:p-12">
          <div className="relative z-10">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <PlayCircleIcon className="size-4" />
              Test panel and execution preview
            </span>

            <p className="my-8 max-w-xl text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              Test payloads, required parameters, response shape, and failure reasons before customers depend on them.
            </p>
          </div>

          <div aria-hidden="true" className="space-y-5">
            <div className="border border-border bg-background">
              <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs">
                <span className="font-medium text-foreground">Example payload</span>
                <span className="text-muted-foreground">JSON</span>
              </div>
              <pre className="overflow-hidden p-3 font-mono text-[11px] leading-5 text-muted-foreground">
{`{
  "orderId": "ORDER-12345",
  "customerEmail": "sara@example.com"
}`}
              </pre>
            </div>

            <div className="ml-auto w-[88%] border border-primary/25 bg-primary/10 p-3 text-xs leading-5 text-foreground">
              Preview: Tinfiz will call a read-only endpoint, redact secrets, and record latency, request status, and response summary.
            </div>
          </div>
        </div>

        <div className="col-span-full border-y border-border p-8 sm:p-10 lg:p-12">
          <div className="grid gap-6 text-center md:grid-cols-3 md:text-left">
            <div>
              <p className="text-4xl font-semibold tracking-tight text-foreground lg:text-6xl">Safe</p>
              <p className="mt-2 text-sm text-muted-foreground">Write actions wait for approval.</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tracking-tight text-foreground lg:text-6xl">Visible</p>
              <p className="mt-2 text-sm text-muted-foreground">Logs show request, response, status, and latency.</p>
            </div>
            <div>
              <p className="text-4xl font-semibold tracking-tight text-foreground lg:text-6xl">Scoped</p>
              <p className="mt-2 text-sm text-muted-foreground">Secrets and outbound domains stay controlled.</p>
            </div>
          </div>
        </div>

        <div className="relative col-span-full overflow-hidden">
          <div className="absolute z-10 max-w-2xl px-6 pt-6 sm:px-10 sm:pt-10 lg:px-12 lg:pt-12">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <ActivityIcon className="size-4" />
              Action logs and approval queue
            </span>

            <p className="my-8 max-w-xl text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">
              Every action leaves a trail. <span className="text-muted-foreground">Teams can review success, retry safe failures, and approve risky writes.</span>
            </p>
          </div>

          <div className="grid min-h-[460px] items-end gap-8 pt-56 md:grid-cols-[0.62fr_0.38fr] md:pt-44">
            <ActionActivityChart />
            <div className="relative z-10 space-y-3 p-6 sm:p-10 lg:p-12">
              {ACTION_EVENTS.map((event) => (
                <div key={event.label} className="border border-border bg-background/92 p-3 backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-foreground">{event.label}</p>
                    <StatusIcon status={event.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{event.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function EndpointMapPreview() {
  return (
    <div aria-hidden="true" className="relative border-t border-border">
      <div className="absolute inset-0 z-10 m-auto size-fit">
        <div className="relative z-10 flex w-fit items-center gap-2 border border-border bg-background px-3 py-1 text-xs font-medium text-foreground shadow-md shadow-foreground/5 dark:bg-muted">
          <span className="flex size-5 items-center justify-center border border-primary/25 bg-primary/10 text-[10px] text-primary">API</span>
          Endpoint allowed: api.store.com
        </div>
        <div className="absolute inset-2 -bottom-2 mx-auto border border-border bg-background px-3 py-4 text-xs font-medium shadow-md shadow-foreground/5 dark:bg-zinc-900" />
      </div>

      <div className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 z-10"
          style={{
            background:
              "radial-gradient(circle at center, transparent 0%, transparent 48%, var(--background) 78%)",
          }}
        />
        <ActionMap />
      </div>
    </div>
  )
}

function ActionMap() {
  return (
    <svg
      viewBox="0 0 120 60"
      className="h-[320px] w-full text-muted-foreground/70 dark:text-muted-foreground/45"
      style={{ background: svgOptions.backgroundColor }}
    >
      {mapPoints.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={svgOptions.radius}
          fill={svgOptions.color}
        />
      ))}
    </svg>
  )
}

function StatusIcon({ status }: { status: string }) {
  if (status === "protected") {
    return <LockKeyholeIcon className="size-4 text-amber-600" />
  }

  if (status === "ready") {
    return <CheckCircle2Icon className="size-4 text-emerald-600" />
  }

  return <KeyRoundIcon className="size-4 text-primary" />
}

function ActionActivityChart() {
  return (
    <div aria-hidden="true" className="relative h-full min-h-[360px] overflow-hidden">
      <ChartContainer
        config={chartConfig}
        className="h-full min-h-[360px] w-full aspect-auto"
        initialDimension={{ width: 760, height: 420 }}
      >
        <AreaChart data={CHART_DATA} margin={{ top: 118, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="actionSuccess" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.52} />
              <stop offset="58%" stopColor="var(--primary)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="actionApprovals" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.42} />
              <stop offset="64%" stopColor="#f59e0b" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.65} />
          <XAxis dataKey="day" hide />
          <Tooltip
            cursor={false}
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: 0,
              background: "var(--background)",
              color: "var(--foreground)",
              boxShadow: "none",
            }}
          />
          <Area
            dataKey="approvals"
            type="stepBefore"
            stackId="actions"
            stroke="#f59e0b"
            strokeWidth={2.4}
            fill="url(#actionApprovals)"
            fillOpacity={1}
            isAnimationActive
            animationDuration={1100}
            animationEasing="ease-out"
          />
          <Area
            dataKey="success"
            type="stepBefore"
            stackId="actions"
            stroke="var(--primary)"
            strokeWidth={2.6}
            fill="url(#actionSuccess)"
            fillOpacity={1}
            isAnimationActive
            animationDuration={1300}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}
