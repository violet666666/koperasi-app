"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, TrendingDown, Users, Building2 } from "lucide-react";
import { SHUSummaryTab } from "./shu-summary-tab";
import { SHUTransactionsTab } from "./shu-transactions-tab";
import { SHUCalculationTab } from "./shu-calculation-tab";
import type { SHUSource, IncomeGroupFilter, DetailSummaryItem, CalculationData } from "../_types";

interface SHUDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  /** What data context to show */
  source: SHUSource;
  /** Dialog title */
  title: string;
  /** Period label for display */
  periodLabel: string;

  /** Summary data for Tab 1 (from existing SHUData) */
  summaryData: DetailSummaryItem[];
  /** Total amount for percentage calculation */
  summaryTotal: number;

  /** Income group filter (only when source="income") */
  incomeGroup?: IncomeGroupFilter;

  /** Calculation data (required when source is member_surplus or non_member_surplus) */
  calculationData?: CalculationData;

  /** Filter context for API calls */
  year: number;
  month?: number | null;
}

const SOURCE_ICONS: Record<SHUSource, React.ReactNode> = {
  income: <PieChart className="h-5 w-5 text-emerald-600" />,
  expense: <TrendingDown className="h-5 w-5 text-red-600" />,
  member_surplus: <Users className="h-5 w-5 text-blue-600" />,
  non_member_surplus: <Building2 className="h-5 w-5 text-amber-600" />,
};

export function SHUDetailDialog({
  open,
  onOpenChange,
  source,
  title,
  periodLabel,
  summaryData,
  summaryTotal,
  incomeGroup,
  calculationData,
  year,
  month,
}: SHUDetailDialogProps) {
  const [activeTab, setActiveTab] = React.useState("summary");
  const [categoryDrillDown, setCategoryDrillDown] = React.useState<string | null>(null);

  const isDerivedValue = source === "member_surplus" || source === "non_member_surplus";
  const variant = source === "income" ? "income" : "expense";

  // Filter summary data by income group if specified
  const filteredSummaryData = React.useMemo(() => {
    if (!incomeGroup || source !== "income") return summaryData;
    // Map income group to code prefixes
    const groupCodeMap: Record<IncomeGroupFilter, string[]> = {
      unit: ["UNT-REV", "TOKO-REV", "OPS-REV", "UT-INC", "ST-INC"],
      sp: ["SP-JASA", "SP-RESIKO", "SP-PENALTI", "LN-INC"],
      lainnya: ["CB-INC", "INC-LAIN", "OPS-MISC"],
    };
    const allowedCodes = groupCodeMap[incomeGroup] || [];
    return summaryData.filter(item => allowedCodes.includes(item.code));
  }, [summaryData, incomeGroup, source]);

  const filteredTotal = React.useMemo(
    () => filteredSummaryData.reduce((sum, item) => sum + item.amount, 0),
    [filteredSummaryData]
  );

  // Reset tab when dialog opens
  React.useEffect(() => {
    if (open) {
      setActiveTab("summary");
      setCategoryDrillDown(null);
      setNestedSource(null);
    }
  }, [open]);

  // Handle category click from summary tab → switch to transactions tab
  const handleCategoryClick = React.useCallback((code: string) => {
    setCategoryDrillDown(code);
    setActiveTab("transactions");
  }, []);

  // Handle drill-down from calculation tab → open nested dialog
  const [nestedSource, setNestedSource] = React.useState<"income" | "expense" | null>(null);

  const handleCalcDrillDown = React.useCallback((drillSource: "income" | "expense") => {
    setNestedSource(drillSource);
  }, []);

  // Find the category name from code for transactions tab filter
  const selectedCategoryLabel = React.useMemo(() => {
    if (!categoryDrillDown) return null;
    const found = summaryData.find(d => d.code === categoryDrillDown);
    return found ? found.name : null;
  }, [categoryDrillDown, summaryData]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {SOURCE_ICONS[source]}
              <span>{title}</span>
              <span className="text-sm font-normal text-muted-foreground ml-2">
                {periodLabel}
              </span>
            </DialogTitle>
          </DialogHeader>

          {isDerivedValue ? (
            /* Derived values: show calculation tab + allocation summary */
            <div className="flex-1 overflow-y-auto">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-3">
                  <TabsTrigger value="summary">Ringkasan Alokasi</TabsTrigger>
                  <TabsTrigger value="calculation">Langkah Kalkulasi</TabsTrigger>
                </TabsList>
                <TabsContent value="summary">
                  {calculationData && (
                    <SHUSummaryTab
                      items={calculationData.allocations.map(a => ({
                        code: a.key,
                        name: a.label,
                        amount: a.amount,
                      }))}
                      total={calculationData.allocations.reduce((s, a) => s + a.amount, 0)}
                      variant="income"
                    />
                  )}
                </TabsContent>
                <TabsContent value="calculation">
                  {calculationData && (
                    <SHUCalculationTab
                      data={calculationData}
                      variant={source === "member_surplus" ? "member" : "non_member"}
                      onDrillDown={handleCalcDrillDown}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </div>
          ) : (
            /* Income/Expense: show summary + transactions tabs */
            <div className="flex-1 overflow-hidden flex flex-col">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mb-3 shrink-0">
                  <TabsTrigger value="summary">Ringkasan per Kategori</TabsTrigger>
                  <TabsTrigger value="transactions">
                    Daftar Transaksi
                    {categoryDrillDown && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({selectedCategoryLabel || categoryDrillDown})
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="summary" className="flex-1 overflow-y-auto">
                  <SHUSummaryTab
                    items={filteredSummaryData}
                    total={filteredTotal}
                    variant={variant}
                    onCategoryClick={handleCategoryClick}
                  />
                </TabsContent>
                <TabsContent value="transactions" className="flex-1 overflow-y-auto">
                  <SHUTransactionsTab
                    source={source}
                    year={year}
                    month={month}
                    incomeGroup={incomeGroup}
                    selectedCategory={categoryDrillDown}
                    availableCategories={filteredSummaryData.map(d => ({ code: d.code, name: d.name }))}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Nested dialog for drill-down from calculation tab */}
      {nestedSource && calculationData && (
        <Dialog open={!!nestedSource} onOpenChange={(o) => { if (!o) setNestedSource(null); }}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {nestedSource === "income"
                  ? <PieChart className="h-5 w-5 text-emerald-600" />
                  : <TrendingDown className="h-5 w-5 text-red-600" />
                }
                <span>Detail: {nestedSource === "income" ? "Total Pendapatan" : "Total Beban"}</span>
                <span className="text-sm font-normal text-muted-foreground ml-2">{periodLabel}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col">
              <SHUTransactionsTab
                source={nestedSource}
                year={year}
                month={month}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
