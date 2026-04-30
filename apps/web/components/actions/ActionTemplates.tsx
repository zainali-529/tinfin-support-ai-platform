'use client'

import type { ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { BoxIcon, CalendarIcon, SendIcon, Building2Icon } from 'lucide-react'
import type { ActionBuilderPayload } from '@/components/actions/ActionBuilder'

interface TemplateItem {
  id: string
  label: string
  description: string
  payload: ActionBuilderPayload
}

interface TemplateGroup {
  id: string
  title: string
  icon: ComponentType<{ className?: string }>
  items: TemplateItem[]
}

interface ActionTemplatesProps {
  onImport: (payload: ActionBuilderPayload) => void
}

const TEMPLATE_GROUPS: TemplateGroup[] = [
  {
    id: 'orca-business-solutions',
    title: 'Orca Business Solutions',
    icon: Building2Icon,
    items: [
      {
        id: 'get_consultation_details',
        label: 'Get Consultation Details',
        description: 'Fetches full consultation details by consultation ID.',
        payload: {
          name: 'get_consultation_details',
          displayName: 'Get Consultation Details',
          description:
            'Fetches consultation details including consultant, schedule, mode, and notes using consultation ID.',
          method: 'GET',
          urlTemplate:
            'http://localhost:3001/api/action-mock/consultations/{consultationId}',
          headersTemplate: {},
          bodyTemplate: null,
          responsePath: 'consultation',
          responseTemplate:
            'Consultation {referenceNumber} is {status}. Service: {serviceName}. Consultant: {consultant}. Scheduled: {startAt}.',
          parameters: [
            {
              name: 'consultationId',
              type: 'string',
              description:
                'Consultation ID provided to the customer, for example CONS-1204 or any booking reference.',
              required: true,
            },
          ],
          requiresConfirmation: false,
          humanApprovalRequired: false,
          timeoutSeconds: 10,
          isActive: true,
          category: 'scheduling',
        },
      },
      {
        id: 'get_consultation_status',
        label: 'Get Consultation Status',
        description: 'Checks consultation status and next step quickly.',
        payload: {
          name: 'get_consultation_status',
          displayName: 'Get Consultation Status',
          description:
            'Checks current consultation status, last update, and next step using consultation ID.',
          method: 'GET',
          urlTemplate:
            'http://localhost:3001/api/action-mock/consultations/{consultationId}/status',
          headersTemplate: {},
          bodyTemplate: null,
          responsePath: 'consultationStatus',
          responseTemplate:
            'Consultation {referenceNumber} is {status}. Update: {lastUpdate}. Next: {nextStep}.',
          parameters: [
            {
              name: 'consultationId',
              type: 'string',
              description: 'Consultation ID to check status for.',
              required: true,
            },
          ],
          requiresConfirmation: false,
          humanApprovalRequired: false,
          timeoutSeconds: 10,
          isActive: true,
          category: 'scheduling',
        },
      },
      {
        id: 'book_consultation',
        label: 'Book Consultation',
        description: 'Creates a new consultation booking with customer details.',
        payload: {
          name: 'book_consultation',
          displayName: 'Book Consultation',
          description:
            'Books a new consultation slot for the customer and returns booking confirmation details.',
          method: 'POST',
          urlTemplate: 'http://localhost:3001/api/action-mock/consultations/book',
          headersTemplate: {
            'Content-Type': 'application/json',
          },
          bodyTemplate:
            '{"name":"{name}","email":"{email}","phone":"{phone}","serviceCode":"{serviceCode}","preferredDate":"{preferredDate}","preferredTime":"{preferredTime}","timezone":"{timezone}","mode":"{mode}","notes":"{notes}"}',
          responsePath: 'booking',
          responseTemplate:
            'Consultation booked. Booking ID: {bookingId}. Status: {status}. Scheduled at: {consultation.startAt}.',
          parameters: [
            {
              name: 'name',
              type: 'string',
              description: 'Customer full name.',
              required: true,
            },
            {
              name: 'email',
              type: 'string',
              description: 'Customer email (optional if phone is provided).',
              required: false,
            },
            {
              name: 'phone',
              type: 'string',
              description: 'Customer phone (optional if email is provided).',
              required: false,
            },
            {
              name: 'serviceCode',
              type: 'enum',
              description: 'Consultation service type.',
              required: true,
              enumValues: [
                'business_strategy',
                'ai_automation',
                'operations_optimization',
                'digital_transformation',
              ],
            },
            {
              name: 'preferredDate',
              type: 'string',
              description: 'Preferred date in YYYY-MM-DD format.',
              required: false,
            },
            {
              name: 'preferredTime',
              type: 'string',
              description: 'Preferred time in HH:mm format.',
              required: false,
            },
            {
              name: 'timezone',
              type: 'string',
              description: 'Timezone, e.g. Asia/Karachi.',
              required: false,
            },
            {
              name: 'mode',
              type: 'enum',
              description: 'Consultation mode.',
              required: false,
              enumValues: ['zoom', 'google_meet', 'phone_call', 'onsite'],
            },
            {
              name: 'notes',
              type: 'string',
              description: 'Optional extra notes from customer.',
              required: false,
            },
          ],
          requiresConfirmation: true,
          humanApprovalRequired: false,
          timeoutSeconds: 12,
          isActive: true,
          category: 'scheduling',
        },
      },
    ],
  },
  {
    id: 'shopify',
    title: 'Shopify',
    icon: BoxIcon,
    items: [
      {
        id: 'get_order_status',
        label: 'Get Order Status',
        description: 'Looks up the latest order status using an order ID.',
        payload: {
          name: 'get_order_status',
          displayName: 'Get Order Status',
          description: 'Fetches order status and delivery ETA for a customer order ID.',
          method: 'GET',
          urlTemplate: 'https://api.yourshop.com/orders/{orderId}',
          headersTemplate: {
            Authorization: 'Bearer {apiKey}',
          },
          bodyTemplate: null,
          responsePath: 'data.order',
          responseTemplate: 'Order {id} is {status}. ETA: {estimatedDelivery}.',
          parameters: [
            {
              name: 'orderId',
              type: 'string',
              description: 'Customer order ID, such as #12345 or ORDER-12345.',
              required: true,
            },
          ],
          requiresConfirmation: false,
          humanApprovalRequired: false,
          timeoutSeconds: 10,
          isActive: true,
          category: 'ecommerce',
        },
      },
      {
        id: 'cancel_order',
        label: 'Cancel Order',
        description: 'Cancels an order when the customer confirms.',
        payload: {
          name: 'cancel_order',
          displayName: 'Cancel Order',
          description: 'Cancels a placed order and returns cancellation confirmation.',
          method: 'POST',
          urlTemplate: 'https://api.yourshop.com/orders/{orderId}/cancel',
          headersTemplate: {
            Authorization: 'Bearer {apiKey}',
            'Content-Type': 'application/json',
          },
          bodyTemplate: '{"reason":"{reason}"}',
          responsePath: 'data',
          responseTemplate: 'Order {orderId} was cancelled successfully.',
          parameters: [
            {
              name: 'orderId',
              type: 'string',
              description: 'Order ID to cancel.',
              required: true,
            },
            {
              name: 'reason',
              type: 'string',
              description: 'Short cancellation reason from customer.',
              required: false,
            },
          ],
          requiresConfirmation: true,
          humanApprovalRequired: true,
          timeoutSeconds: 12,
          isActive: true,
          category: 'ecommerce',
        },
      },
      {
        id: 'track_shipment',
        label: 'Track Shipment',
        description: 'Fetches live carrier shipment updates.',
        payload: {
          name: 'track_shipment',
          displayName: 'Track Shipment',
          description: 'Tracks a shipment and returns latest carrier checkpoint and ETA.',
          method: 'GET',
          urlTemplate: 'https://api.yourshop.com/shipments/{trackingNumber}',
          headersTemplate: {
            Authorization: 'Bearer {apiKey}',
          },
          bodyTemplate: null,
          responsePath: 'data',
          responseTemplate:
            'Shipment {trackingNumber} is {status}. Latest update: {lastCheckpoint}. ETA: {eta}.',
          parameters: [
            {
              name: 'trackingNumber',
              type: 'string',
              description: 'Carrier tracking number mentioned by customer.',
              required: true,
            },
          ],
          requiresConfirmation: false,
          humanApprovalRequired: false,
          timeoutSeconds: 10,
          isActive: true,
          category: 'ecommerce',
        },
      },
    ],
  },
  {
    id: 'calendly',
    title: 'Calendly',
    icon: CalendarIcon,
    items: [
      {
        id: 'check_availability',
        label: 'Check Availability',
        description: 'Checks available time slots for a date range.',
        payload: {
          name: 'check_availability',
          displayName: 'Check Availability',
          description: 'Checks available appointment slots for a date and timezone.',
          method: 'GET',
          urlTemplate:
            'https://api.calendly.com/availability?date={date}&timezone={timezone}',
          headersTemplate: {
            Authorization: 'Bearer {apiKey}',
          },
          bodyTemplate: null,
          responsePath: 'data',
          responseTemplate: 'Available slots: {slots}.',
          parameters: [
            {
              name: 'date',
              type: 'string',
              description: 'Requested appointment date in YYYY-MM-DD format.',
              required: true,
            },
            {
              name: 'timezone',
              type: 'string',
              description: 'Customer timezone like America/New_York.',
              required: true,
            },
          ],
          requiresConfirmation: false,
          humanApprovalRequired: false,
          timeoutSeconds: 10,
          isActive: true,
          category: 'scheduling',
        },
      },
      {
        id: 'book_appointment',
        label: 'Book Appointment',
        description: 'Creates a booking after customer confirmation.',
        payload: {
          name: 'book_appointment',
          displayName: 'Book Appointment',
          description: 'Books an appointment using selected time and customer details.',
          method: 'POST',
          urlTemplate: 'https://api.calendly.com/bookings',
          headersTemplate: {
            Authorization: 'Bearer {apiKey}',
            'Content-Type': 'application/json',
          },
          bodyTemplate:
            '{"name":"{customerName}","email":"{customerEmail}","startTime":"{startTime}","timezone":"{timezone}"}',
          responsePath: 'data',
          responseTemplate: 'Appointment confirmed for {startTime}. Booking ID: {id}.',
          parameters: [
            {
              name: 'customerName',
              type: 'string',
              description: 'Customer full name for booking.',
              required: true,
            },
            {
              name: 'customerEmail',
              type: 'string',
              description: 'Customer email address for confirmation.',
              required: true,
            },
            {
              name: 'startTime',
              type: 'string',
              description: 'Selected slot time in ISO format.',
              required: true,
            },
            {
              name: 'timezone',
              type: 'string',
              description: 'Customer timezone.',
              required: true,
            },
          ],
          requiresConfirmation: true,
          humanApprovalRequired: false,
          timeoutSeconds: 12,
          isActive: true,
          category: 'scheduling',
        },
      },
    ],
  },
  {
    id: 'webhook',
    title: 'Generic Webhook',
    icon: SendIcon,
    items: [
      {
        id: 'trigger_webhook',
        label: 'Trigger Webhook',
        description: 'Sends conversation events to your external system.',
        payload: {
          name: 'trigger_webhook',
          displayName: 'Trigger Webhook',
          description: 'Triggers a generic webhook for external automations.',
          method: 'POST',
          urlTemplate: 'https://api.yourapp.com/webhooks/customer-support',
          headersTemplate: {
            Authorization: 'Bearer {apiKey}',
            'Content-Type': 'application/json',
          },
          bodyTemplate:
            '{"event":"{eventName}","conversationId":"{conversationId}","payload":"{payload}"}',
          responsePath: 'data',
          responseTemplate: 'Webhook accepted with status: {status}.',
          parameters: [
            {
              name: 'eventName',
              type: 'string',
              description: 'Event name for downstream automation.',
              required: true,
            },
            {
              name: 'conversationId',
              type: 'string',
              description: 'Conversation ID for reference.',
              required: true,
            },
            {
              name: 'payload',
              type: 'string',
              description: 'Compact payload summary to pass through.',
              required: false,
            },
          ],
          requiresConfirmation: false,
          humanApprovalRequired: false,
          timeoutSeconds: 10,
          isActive: true,
          category: 'custom',
        },
      },
    ],
  },
]

export function ActionTemplates({ onImport }: ActionTemplatesProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Start Templates</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {TEMPLATE_GROUPS.map((group) => (
          <section key={group.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <group.icon className="size-4 text-primary" />
              <h3 className="text-sm font-semibold">{group.title}</h3>
              <Badge variant="outline" className="h-5 text-[10px]">
                {group.items.length}
              </Badge>
            </div>

            <div className="space-y-2">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => onImport(item.payload)}
                  >
                    Import
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}
