"use client";

import { Badge, Button, Card, DataTable, Input, useToast } from "@fresh-cup/ui";
import type { ExchangeRate, TaxRule } from "@fresh-cup/types";
import { useState } from "react";
import {
  useCreateTaxRule,
  useCurrencies,
  useDeleteTaxRule,
  useExchangeRates,
  useSetExchangeRate,
  useTaxRules,
} from "@/lib/use-enterprise";

export default function EnterpriseGlobalizationPage() {
  const { data: currencies, isLoading: isCurrenciesLoading } = useCurrencies();
  const { data: exchangeRates, isLoading: isRatesLoading } = useExchangeRates();
  const setExchangeRate = useSetExchangeRate();
  const { data: taxRules, isLoading: isTaxRulesLoading } = useTaxRules();
  const createTaxRule = useCreateTaxRule();
  const deleteTaxRule = useDeleteTaxRule();
  const { show: showToast } = useToast();

  const [baseCurrencyCode, setBaseCurrencyCode] = useState("");
  const [quoteCurrencyCode, setQuoteCurrencyCode] = useState("");
  const [rate, setRate] = useState("");

  const [taxCountryCode, setTaxCountryCode] = useState("");
  const [taxName, setTaxName] = useState("");
  const [taxRatePercent, setTaxRatePercent] = useState("");

  async function handleSetRate() {
    try {
      await setExchangeRate.mutateAsync({
        baseCurrencyCode: baseCurrencyCode.toUpperCase(),
        quoteCurrencyCode: quoteCurrencyCode.toUpperCase(),
        rate: Number(rate),
      });
      showToast({ title: "Exchange rate saved", tone: "success" });
      setBaseCurrencyCode("");
      setQuoteCurrencyCode("");
      setRate("");
    } catch {
      showToast({ title: "Could not save exchange rate", tone: "error" });
    }
  }

  async function handleCreateTaxRule() {
    try {
      await createTaxRule.mutateAsync({
        countryCode: taxCountryCode.toUpperCase(),
        name: taxName,
        ratePercent: Number(taxRatePercent),
      });
      showToast({ title: "Tax rule created", tone: "success" });
      setTaxCountryCode("");
      setTaxName("");
      setTaxRatePercent("");
    } catch {
      showToast({ title: "Could not create tax rule", tone: "error" });
    }
  }

  async function handleDeleteTaxRule(id: string) {
    try {
      await deleteTaxRule.mutateAsync(id);
      showToast({ title: "Tax rule deleted", tone: "success" });
    } catch {
      showToast({ title: "Could not delete tax rule", tone: "error" });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">Currency registry</h2>
        <DataTable
          loading={isCurrenciesLoading}
          rows={currencies ?? []}
          rowKey={(row) => row.code}
          emptyTitle="No currencies registered"
          columns={[
            { key: "code", header: "Code", render: (row) => row.code },
            { key: "name", header: "Name", render: (row) => row.name },
            { key: "symbol", header: "Symbol", render: (row) => row.symbol },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">
          Exchange rates{" "}
          <span className="text-body-sm font-normal text-fg-muted">
            — admin-maintained, not a live FX feed
          </span>
        </h2>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Input
            label="Base"
            value={baseCurrencyCode}
            onChange={(e) => setBaseCurrencyCode(e.target.value)}
            hint="e.g. USD"
          />
          <Input
            label="Quote"
            value={quoteCurrencyCode}
            onChange={(e) => setQuoteCurrencyCode(e.target.value)}
            hint="e.g. ETB"
          />
          <Input
            label="Rate"
            type="number"
            step="0.0001"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <div className="flex items-end">
            <Button onClick={handleSetRate} loading={setExchangeRate.isPending}>
              Save rate
            </Button>
          </div>
        </div>
        <DataTable<ExchangeRate>
          loading={isRatesLoading}
          rows={exchangeRates ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No exchange rates on file"
          columns={[
            {
              key: "pair",
              header: "Pair",
              render: (row) => `${row.baseCurrencyCode} → ${row.quoteCurrencyCode}`,
            },
            { key: "rate", header: "Rate", render: (row) => row.rate },
            { key: "asOf", header: "As of", render: (row) => new Date(row.asOf).toLocaleString() },
          ]}
        />
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-h5 text-fg">
          Tax rules{" "}
          <span className="text-body-sm font-normal text-fg-muted">
            — rule-based lookup, not a live tax-jurisdiction API
          </span>
        </h2>
        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Input
            label="Country"
            value={taxCountryCode}
            onChange={(e) => setTaxCountryCode(e.target.value)}
            hint="e.g. ET"
          />
          <Input label="Name" value={taxName} onChange={(e) => setTaxName(e.target.value)} />
          <Input
            label="Rate %"
            type="number"
            step="0.1"
            value={taxRatePercent}
            onChange={(e) => setTaxRatePercent(e.target.value)}
          />
          <div className="flex items-end">
            <Button onClick={handleCreateTaxRule} loading={createTaxRule.isPending}>
              Add rule
            </Button>
          </div>
        </div>
        <DataTable<TaxRule>
          loading={isTaxRulesLoading}
          rows={taxRules ?? []}
          rowKey={(row) => row.id}
          emptyTitle="No tax rules configured"
          columns={[
            { key: "country", header: "Country", render: (row) => row.countryCode },
            { key: "name", header: "Name", render: (row) => row.name },
            { key: "rate", header: "Rate %", render: (row) => row.ratePercent },
            {
              key: "mode",
              header: "Mode",
              render: (row) => (
                <Badge tone="neutral">{row.isInclusive ? "Inclusive (VAT)" : "Exclusive"}</Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              render: (row) => (
                <Button
                  variant="ghost"
                  onClick={() => handleDeleteTaxRule(row.id)}
                  loading={deleteTaxRule.isPending}
                >
                  Delete
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
