import { Router, type Request, type Response } from 'express'

export const actionMockRoute: Router = Router()

type MockOrderStatus =
  | 'processing'
  | 'packed'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'

type MockConsultationStatus =
  | 'requested'
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'

type MockConsultationMode =
  | 'zoom'
  | 'google_meet'
  | 'phone_call'
  | 'onsite'

interface ConsultationService {
  code: string
  title: string
  durationMinutes: number
  feeUsd: number
}

interface MockConsultationPayload {
  id: string
  referenceNumber: string
  company: string
  status: MockConsultationStatus
  serviceCode: string
  serviceName: string
  consultant: string
  mode: MockConsultationMode
  startAt: string
  endAt: string
  timezone: string
  durationMinutes: number
  customer: {
    name: string
    email: string
    phone: string
  }
  fee: {
    amount: string
    currency: string
  }
  joinUrl: string | null
  location: string | null
  notes: string
  lastUpdate: string
  nextStep: string
}

const STATUS_SEQUENCE: MockOrderStatus[] = [
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered',
]

const CONSULTATION_STATUS_SEQUENCE: MockConsultationStatus[] = [
  'requested',
  'scheduled',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]

const CONSULTATION_SERVICES: ConsultationService[] = [
  {
    code: 'business_strategy',
    title: 'Business Strategy Consultation',
    durationMinutes: 60,
    feeUsd: 250,
  },
  {
    code: 'ai_automation',
    title: 'AI Automation Consultation',
    durationMinutes: 75,
    feeUsd: 350,
  },
  {
    code: 'operations_optimization',
    title: 'Operations Optimization Session',
    durationMinutes: 60,
    feeUsd: 300,
  },
  {
    code: 'digital_transformation',
    title: 'Digital Transformation Roadmap',
    durationMinutes: 90,
    feeUsd: 420,
  },
]

const CONSULTANTS = [
  'Ayesha Khan',
  'Hamza Malik',
  'Sara Iqbal',
  'Ali Raza',
]

const CONSULTATION_MODES: MockConsultationMode[] = [
  'zoom',
  'google_meet',
  'phone_call',
  'onsite',
]

function getOrderId(input: string | undefined): string {
  return (input ?? '').trim()
}

function getConsultationId(input: string | undefined): string {
  return (input ?? '').trim()
}

function toNumericHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash += value.charCodeAt(i) * (i + 1)
  }
  return Math.abs(hash)
}

function buildEta(hash: number, status: MockOrderStatus): string {
  if (status === 'delivered') return 'Delivered'
  if (status === 'out_for_delivery') return 'Today by 6:00 PM'
  const days = (hash % 3) + 1
  return `${days} day(s)`
}

function buildOrderPayload(orderId: string): Record<string, unknown> {
  const hash = toNumericHash(orderId)
  const status = STATUS_SEQUENCE[hash % STATUS_SEQUENCE.length] ?? 'processing'
  const amount = ((hash % 180) + 20 + 0.99).toFixed(2)
  const trackNum = `TRK-${(100000 + (hash % 900000)).toString()}`

  return {
    success: true,
    order: {
      id: orderId,
      status,
      estimatedDelivery: buildEta(hash, status),
      courier: hash % 2 === 0 ? 'DHL' : 'FedEx',
      trackingNumber: trackNum,
      lastUpdate:
        status === 'delivered'
          ? 'Package delivered to customer.'
          : status === 'out_for_delivery'
            ? 'Courier is on the way.'
            : 'Order is moving through fulfillment.',
      totalAmount: amount,
      currency: 'USD',
    },
  }
}

function normalizeServiceCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function readBodyString(body: unknown, key: string): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return ''
  const value = (body as Record<string, unknown>)[key]
  return typeof value === 'string' ? value.trim() : ''
}

function pickConsultationService(
  hash: number,
  requestedCode?: string
): ConsultationService {
  if (requestedCode) {
    const normalized = normalizeServiceCode(requestedCode)
    const requested = CONSULTATION_SERVICES.find(
      (service) => service.code === normalized
    )
    if (requested) return requested
  }

  return (
    CONSULTATION_SERVICES[hash % CONSULTATION_SERVICES.length] ??
    CONSULTATION_SERVICES[0]!
  )
}

function pickConsultationMode(
  hash: number,
  requestedMode?: string
): MockConsultationMode {
  if (requestedMode) {
    const normalized = normalizeServiceCode(requestedMode)
    const knownMode = CONSULTATION_MODES.find((mode) => mode === normalized)
    if (knownMode) return knownMode
  }

  return CONSULTATION_MODES[hash % CONSULTATION_MODES.length] ?? 'zoom'
}

function buildConsultationStatusMessage(status: MockConsultationStatus): string {
  if (status === 'requested') {
    return 'Consultation request received. A consultant will confirm shortly.'
  }
  if (status === 'scheduled') {
    return 'Consultation has been scheduled successfully.'
  }
  if (status === 'confirmed') {
    return 'Consultation is confirmed. Join details have been shared.'
  }
  if (status === 'in_progress') {
    return 'Consultation is currently in progress.'
  }
  if (status === 'completed') {
    return 'Consultation completed. Follow-up summary will be shared soon.'
  }
  if (status === 'cancelled') {
    return 'Consultation was cancelled. You can request a new slot.'
  }

  return 'Consultation was marked as no-show. Please rebook to continue.'
}

function buildConsultationSchedule(
  hash: number,
  durationMinutes: number,
  options?: { preferredDate?: string; preferredTime?: string }
): { startAt: string; endAt: string } {
  const preferredDate = options?.preferredDate?.trim() ?? ''
  const preferredTime = options?.preferredTime?.trim() ?? ''

  let start: Date | null = null

  if (preferredDate) {
    const timePart = preferredTime || '10:00'
    const normalizedTime =
      timePart.length === 5 ? `${timePart}:00` : timePart
    const parsed = new Date(`${preferredDate}T${normalizedTime}`)
    if (!Number.isNaN(parsed.getTime())) {
      start = parsed
    }
  }

  if (!start) {
    start = new Date()
    start.setUTCSeconds(0, 0)
    start.setUTCMinutes(0)
    start.setUTCHours(9 + (hash % 8))
    start.setUTCDate(start.getUTCDate() + ((hash % 10) + 1))
  }

  const end = new Date(start.getTime() + durationMinutes * 60_000)

  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  }
}

function buildConsultationPayload(
  consultationId: string,
  options?: {
    status?: MockConsultationStatus
    serviceCode?: string
    preferredDate?: string
    preferredTime?: string
    timezone?: string
    customerName?: string
    customerEmail?: string
    customerPhone?: string
    mode?: string
    notes?: string
  }
): MockConsultationPayload {
  const hash = toNumericHash(consultationId)
  const service = pickConsultationService(hash, options?.serviceCode)
  const status =
    options?.status ??
    CONSULTATION_STATUS_SEQUENCE[hash % CONSULTATION_STATUS_SEQUENCE.length] ??
    'scheduled'
  const mode = pickConsultationMode(hash, options?.mode)
  const timezone = options?.timezone?.trim() || 'Asia/Karachi'
  const consultant = CONSULTANTS[hash % CONSULTANTS.length] ?? 'Consultant Team'
  const schedule = buildConsultationSchedule(hash, service.durationMinutes, {
    preferredDate: options?.preferredDate,
    preferredTime: options?.preferredTime,
  })

  const customerName =
    options?.customerName?.trim() || `Client ${(hash % 900) + 100}`
  const customerEmail =
    options?.customerEmail?.trim() ||
    `client${(hash % 9000) + 1000}@example.com`
  const customerPhone =
    options?.customerPhone?.trim() ||
    `+1-555-${String(1000 + (hash % 9000)).padStart(4, '0')}`

  const feeAmount = (service.feeUsd + (hash % 3) * 25).toFixed(2)
  const joinUrl =
    mode === 'zoom'
      ? `https://zoom.us/j/${(100000000 + (hash % 900000000)).toString()}`
      : mode === 'google_meet'
        ? `https://meet.google.com/orca-${(100 + (hash % 900)).toString()}`
        : null

  return {
    id: consultationId,
    referenceNumber: `CONS-${String(1000 + (hash % 9000)).padStart(4, '0')}`,
    company: 'Orca Business Solutions',
    status,
    serviceCode: service.code,
    serviceName: service.title,
    consultant,
    mode,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    timezone,
    durationMinutes: service.durationMinutes,
    customer: {
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    },
    fee: {
      amount: feeAmount,
      currency: 'USD',
    },
    joinUrl,
    location:
      mode === 'onsite'
        ? 'Orca Business Solutions HQ, Meeting Room 2'
        : mode === 'phone_call'
          ? 'Phone Call'
          : null,
    notes:
      options?.notes?.trim() ||
      'Please be ready with your business goals and current challenges.',
    lastUpdate: buildConsultationStatusMessage(status),
    nextStep:
      status === 'requested'
        ? 'A consultant will confirm your slot shortly.'
        : status === 'scheduled' || status === 'confirmed'
          ? 'Join on time using the provided meeting details.'
          : status === 'in_progress'
            ? 'Consultation is currently running.'
            : status === 'completed'
              ? 'You may request a follow-up consultation if needed.'
              : 'Contact support to rebook your consultation.',
  }
}

actionMockRoute.get('/orders/:orderId', (req: Request, res: Response) => {
  const orderId = getOrderId(req.params.orderId)
  if (!orderId) {
    return res.status(400).json({
      success: false,
      error: 'orderId is required',
    })
  }

  return res.status(200).json(buildOrderPayload(orderId))
})

actionMockRoute.post('/orders/:orderId/cancel', (req: Request, res: Response) => {
  const orderId = getOrderId(req.params.orderId)
  if (!orderId) {
    return res.status(400).json({
      success: false,
      error: 'orderId is required',
    })
  }

  const reason =
    typeof req.body?.reason === 'string' && req.body.reason.trim().length > 0
      ? req.body.reason.trim()
      : 'Customer requested cancellation'

  return res.status(200).json({
    success: true,
    cancellation: {
      orderId,
      status: 'cancelled',
      refundStatus: 'initiated',
      cancelledAt: new Date().toISOString(),
      reason,
      message: `Order ${orderId} has been cancelled successfully.`,
    },
  })
})

actionMockRoute.get(
  '/consultations/:consultationId',
  (req: Request, res: Response) => {
    const consultationId = getConsultationId(req.params.consultationId)
    if (!consultationId) {
      return res.status(400).json({
        success: false,
        error: 'consultationId is required',
      })
    }

    return res.status(200).json({
      success: true,
      consultation: buildConsultationPayload(consultationId),
    })
  }
)

actionMockRoute.get(
  '/consultations/:consultationId/status',
  (req: Request, res: Response) => {
    const consultationId = getConsultationId(req.params.consultationId)
    if (!consultationId) {
      return res.status(400).json({
        success: false,
        error: 'consultationId is required',
      })
    }

    const consultation = buildConsultationPayload(consultationId)

    return res.status(200).json({
      success: true,
      consultationStatus: {
        consultationId,
        referenceNumber: consultation.referenceNumber,
        status: consultation.status,
        serviceName: consultation.serviceName,
        consultant: consultation.consultant,
        startAt: consultation.startAt,
        timezone: consultation.timezone,
        lastUpdate: consultation.lastUpdate,
        nextStep: consultation.nextStep,
      },
    })
  }
)

actionMockRoute.post('/consultations/book', (req: Request, res: Response) => {
  const customerName = readBodyString(req.body, 'name')
  const customerEmail = readBodyString(req.body, 'email')
  const customerPhone = readBodyString(req.body, 'phone')

  if (!customerName) {
    return res.status(400).json({
      success: false,
      error: 'name is required for consultation booking',
    })
  }

  if (!customerEmail && !customerPhone) {
    return res.status(400).json({
      success: false,
      error: 'Provide at least email or phone for booking',
    })
  }

  const serviceCode = readBodyString(req.body, 'serviceCode')
  const preferredDate = readBodyString(req.body, 'preferredDate')
  const preferredTime = readBodyString(req.body, 'preferredTime')
  const timezone = readBodyString(req.body, 'timezone')
  const mode = readBodyString(req.body, 'mode')
  const notes = readBodyString(req.body, 'notes')

  const bookingSeed = `${customerName}|${customerEmail}|${customerPhone}|${serviceCode}|${preferredDate}|${preferredTime}|${Date.now()}`
  const bookingHash = toNumericHash(bookingSeed)
  const bookingId = `CONSBOOK-${Date.now().toString(36).toUpperCase()}${String(bookingHash % 1000).padStart(3, '0')}`

  const consultation = buildConsultationPayload(bookingId, {
    status: 'scheduled',
    serviceCode,
    preferredDate,
    preferredTime,
    timezone,
    customerName,
    customerEmail,
    customerPhone,
    mode,
    notes,
  })

  return res.status(200).json({
    success: true,
    booking: {
      bookingId,
      status: consultation.status,
      createdAt: new Date().toISOString(),
      message: `Consultation booked successfully for ${consultation.startAt}.`,
      consultation,
    },
  })
})

actionMockRoute.get(
  '/consultations/bookings/:bookingId',
  (req: Request, res: Response) => {
    const bookingId = getConsultationId(req.params.bookingId)
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'bookingId is required',
      })
    }

    const consultation = buildConsultationPayload(bookingId)

    return res.status(200).json({
      success: true,
      booking: {
        bookingId,
        status: consultation.status,
        consultation,
      },
    })
  }
)

actionMockRoute.get('/health', (_req: Request, res: Response) => {
  return res.status(200).json({
    ok: true,
    service: 'action-mock',
  })
})
