'use client'

import type { ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card'
import { Button } from '@workspace/ui/components/button'
import { Badge } from '@workspace/ui/components/badge'
import { BoxIcon, CalendarIcon, CreditCardIcon, SendIcon, UserRoundIcon } from 'lucide-react'
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
  importLabel?: string
}

const TEMPLATE_GROUPS: TemplateGroup[] = [
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
    id: 'stripe',
    title: 'Stripe',
    icon: CreditCardIcon,
    items: [
      {
        id: 'stripe_find_customer',
        label: 'Find Customer',
        description: 'Finds a Stripe customer by email address.',
        payload: {
          name: 'stripe_find_customer',
          displayName: 'Stripe Find Customer',
          description:
            'Finds a customer in Stripe using their email address. Use for billing account lookup only.',
          method: 'GET',
          urlTemplate: 'https://api.stripe.com/v1/customers?email={email}&limit=1',
          headersTemplate: {
            Authorization: 'Bearer {stripeSecretKey}',
          },
          bodyTemplate: null,
          responsePath: 'data.0',
          responseTemplate:
            'Stripe customer found: {email}. Customer ID: {id}. Delinquent: {delinquent}.',
          parameters: [
            {
              name: 'email',
              type: 'string',
              description: 'Customer email address used for billing.',
              extractionHint: 'Ask for the billing email if the customer has not provided it.',
              required: true,
            },
          ],
          requiresConfirmation: false,
          humanApprovalRequired: false,
          timeoutSeconds: 12,
          isActive: true,
          category: 'account',
        },
      },
      {
        id: 'stripe_list_invoices',
        label: 'List Recent Invoices',
        description: 'Lists recent invoices for a Stripe customer.',
        payload: {
          name: 'stripe_list_invoices',
          displayName: 'Stripe Recent Invoices',
          description:
            'Lists recent Stripe invoices for a customer ID. Use only after the customer has provided or confirmed their Stripe customer ID.',
          method: 'GET',
          urlTemplate: 'https://api.stripe.com/v1/invoices?customer={customerId}&limit=3',
          headersTemplate: {
            Authorization: 'Bearer {stripeSecretKey}',
          },
          bodyTemplate: null,
          responsePath: 'data',
          responseTemplate: 'Recent invoices: {data}.',
          parameters: [
            {
              name: 'customerId',
              type: 'string',
              description: 'Stripe customer ID, usually starts with cus_.',
              extractionHint: 'Use only a customer ID from Stripe or an approved internal source.',
              required: true,
            },
          ],
          requiresConfirmation: false,
          humanApprovalRequired: true,
          timeoutSeconds: 12,
          isActive: true,
          category: 'account',
        },
      },
    ],
  },
  {
    id: 'customer-account',
    title: 'Customer Account',
    icon: UserRoundIcon,
    items: [
      {
        id: 'lookup_customer_plan',
        label: 'Lookup Customer Plan',
        description: 'Reads plan, account status, and next renewal date.',
        payload: {
          name: 'lookup_customer_plan',
          displayName: 'Lookup Customer Plan',
          description:
            'Looks up a customer account by email and returns plan, account status, and renewal details.',
          method: 'GET',
          urlTemplate: 'https://api.yourapp.com/customers/{email}/plan',
          headersTemplate: {
            Authorization: 'Bearer {apiKey}',
          },
          bodyTemplate: null,
          responsePath: 'data',
          responseTemplate: 'Plan: {plan}. Status: {status}. Renewal date: {renewalDate}.',
          parameters: [
            {
              name: 'email',
              type: 'string',
              description: 'Customer account email address.',
              extractionHint: 'Ask for the account email if the customer is not identified.',
              required: true,
            },
          ],
          requiresConfirmation: false,
          humanApprovalRequired: false,
          timeoutSeconds: 10,
          isActive: true,
          category: 'account',
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

export function ActionTemplates({ onImport, importLabel = 'Import' }: ActionTemplatesProps) {
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
                    {importLabel}
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
