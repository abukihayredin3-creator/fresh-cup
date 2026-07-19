"use client";

import { formatMoney } from "@fresh-cup/utils";
import { Badge, Button, Card, DataTable, Input, Select, Skeleton, useToast } from "@fresh-cup/ui";
import type { BadgeProps } from "@fresh-cup/ui";
import type { PurchaseOrderStatus } from "@fresh-cup/types";
import Link from "next/link";
import { use, useState } from "react";
import { useInventoryItems } from "@/lib/use-inventory";
import {
  useAddPayment,
  useAttachInvoice,
  useCancelPurchaseOrder,
  usePurchaseOrder,
  useReceivePurchaseOrder,
  useSubmitPurchaseOrder,
  useSupplier,
} from "@/lib/use-purchasing";

const STATUS_TONE: Record<PurchaseOrderStatus, NonNullable<BadgeProps["tone"]>> = {
  DRAFT: "neutral",
  SUBMITTED: "orange",
  RECEIVED: "green",
  CANCELLED: "error",
};

function money(amount: number): string {
  return formatMoney({ amount, currency: "ETB" });
}

function LinesCard({ orderId }: { orderId: string }) {
  const { data: order, isLoading } = usePurchaseOrder(orderId);
  const { data: inventoryItems } = useInventoryItems({ branchId: order?.branchId });
  const itemById = new Map((inventoryItems?.items ?? []).map((i) => [i.id, i.name]));

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">Order lines</p>
      <DataTable
        caption="Order lines"
        loading={isLoading}
        rows={order?.lines ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No lines"
        columns={[
          {
            key: "item",
            header: "Item",
            render: (row) => itemById.get(row.inventoryItemId) ?? "—",
          },
          { key: "ordered", header: "Ordered", render: (row) => row.quantityOrdered },
          { key: "received", header: "Received", render: (row) => row.quantityReceived ?? "—" },
          { key: "cost", header: "Unit cost", render: (row) => money(row.unitCost) },
        ]}
      />
    </Card>
  );
}

function PaymentsCard({ orderId }: { orderId: string }) {
  const { data: order, isLoading } = usePurchaseOrder(orderId);
  const addPayment = useAddPayment(orderId);
  const { show: showToast } = useToast();

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [note, setNote] = useState("");

  async function handleAdd() {
    if (!amount) return;
    try {
      await addPayment.mutateAsync({
        amount: Math.round(Number(amount) * 100),
        method,
        note: note || undefined,
      });
      setAmount("");
      setNote("");
      showToast({ title: "Payment recorded", tone: "success" });
    } catch {
      showToast({ title: "Could not record payment", tone: "error" });
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">
        Payments {order ? `— total paid ${money(order.totalPaid)}` : ""}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Amount (ETB)"
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32"
        />
        <Select
          label="Method"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={[
            { value: "CASH", label: "Cash" },
            { value: "BANK_TRANSFER", label: "Bank transfer" },
            { value: "MOBILE_MONEY", label: "Mobile money" },
          ]}
        />
        <Input
          label="Note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="min-w-40"
        />
        <Button onClick={handleAdd} loading={addPayment.isPending} disabled={!amount}>
          Add payment
        </Button>
      </div>
      <DataTable
        caption="Payments"
        loading={isLoading}
        rows={order?.payments ?? []}
        rowKey={(row) => row.id}
        emptyTitle="No payments recorded"
        columns={[
          { key: "amount", header: "Amount", render: (row) => money(row.amount) },
          { key: "method", header: "Method", render: (row) => row.method },
          { key: "note", header: "Note", render: (row) => row.note ?? "—" },
          {
            key: "date",
            header: "Date",
            render: (row) => new Date(row.paidAt).toLocaleDateString(),
          },
        ]}
      />
    </Card>
  );
}

function InvoiceCard({ orderId }: { orderId: string }) {
  const { data: order } = usePurchaseOrder(orderId);
  const attachInvoice = useAttachInvoice(orderId);
  const { show: showToast } = useToast();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");

  async function handleAttach() {
    try {
      await attachInvoice.mutateAsync({
        invoiceNumber: invoiceNumber || undefined,
        invoiceUrl: invoiceUrl || undefined,
      });
      showToast({ title: "Invoice attached", tone: "success" });
    } catch {
      showToast({ title: "Could not attach invoice", tone: "error" });
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-body font-medium text-fg">Invoice</p>
      {order?.invoiceNumber ? (
        <p className="text-body-sm text-fg-muted">
          {order.invoiceNumber} {order.invoiceUrl ? `— ${order.invoiceUrl}` : ""}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <Input
          label="Invoice number"
          value={invoiceNumber}
          onChange={(e) => setInvoiceNumber(e.target.value)}
        />
        <Input
          label="Invoice URL"
          value={invoiceUrl}
          onChange={(e) => setInvoiceUrl(e.target.value)}
          className="min-w-56"
        />
        <Button
          onClick={handleAttach}
          loading={attachInvoice.isPending}
          disabled={!invoiceNumber.trim() && !invoiceUrl.trim()}
        >
          Attach
        </Button>
      </div>
    </Card>
  );
}

export default function PurchaseOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, isLoading } = usePurchaseOrder(id);
  const { data: supplier } = useSupplier(order?.supplierId ?? "");
  const submitOrder = useSubmitPurchaseOrder(id);
  const receiveOrder = useReceivePurchaseOrder(id);
  const cancelOrder = useCancelPurchaseOrder(id);
  const { show: showToast } = useToast();

  async function handleSubmit() {
    try {
      await submitOrder.mutateAsync();
      showToast({ title: "Order submitted", tone: "success" });
    } catch {
      showToast({ title: "Could not submit order", tone: "error" });
    }
  }

  async function handleReceive() {
    try {
      await receiveOrder.mutateAsync({});
      showToast({ title: "Order received", tone: "success" });
    } catch {
      showToast({ title: "Could not receive order", tone: "error" });
    }
  }

  async function handleCancel() {
    try {
      await cancelOrder.mutateAsync();
      showToast({ title: "Order cancelled", tone: "success" });
    } catch {
      showToast({ title: "Could not cancel order", tone: "error" });
    }
  }

  if (isLoading || !order) {
    return (
      <Card className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-h3 text-fg">Order {order.id.slice(0, 8)}</h1>
          <Badge tone={STATUS_TONE[order.status]}>{order.status}</Badge>
        </div>
        <Link href="/purchasing" className="text-body-sm text-accent-text hover:underline">
          Back to purchasing
        </Link>
      </div>
      {supplier ? <p className="text-body-sm text-fg-muted">Supplier: {supplier.name}</p> : null}

      <div className="flex flex-wrap gap-3">
        {order.status === "DRAFT" ? (
          <Button onClick={handleSubmit} loading={submitOrder.isPending}>
            Submit
          </Button>
        ) : null}
        {order.status === "SUBMITTED" ? (
          <Button onClick={handleReceive} loading={receiveOrder.isPending}>
            Mark received
          </Button>
        ) : null}
        {order.status === "DRAFT" || order.status === "SUBMITTED" ? (
          <Button variant="secondary" onClick={handleCancel} loading={cancelOrder.isPending}>
            Cancel order
          </Button>
        ) : null}
      </div>

      <LinesCard orderId={id} />
      <InvoiceCard orderId={id} />
      <PaymentsCard orderId={id} />
    </div>
  );
}
