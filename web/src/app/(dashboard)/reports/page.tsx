"use client";

import { useMemo } from "react";
import { endOfMonth, startOfMonth } from "date-fns";
import { useStore } from "@/lib/store";
import { calendarDateKey, computeDurationSeconds, isUnitsEntry } from "@/types/data";
import type { GoalDefinition, ServiceType, TimeEntry } from "@/types/data";
import { formatDuration } from "@/lib/utils";
import { monthShortYear, useT } from "@/lib/i18n";

type ServiceTotals = {
  id: string;
  name: string;
  color: string;
  icon: string;
  entryType: ServiceType["entry_type"];
  seconds: number;
  count: number;
  units: number;
  unitsCount: number;
};

type GoalMetric = {
  kind: "duration" | "units";
  actual: number;
  goal: number;
  percent: number;
  fill: string;
  opacity: number;
  showBar: boolean;
};

type GoalSummary = {
  overallPercent: number;
  completedCount: number;
  totalCount: number;
  isComplete: boolean;
};

type ServiceTag = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

type CombinedGoalCardData = {
  goal: GoalDefinition;
  serviceTags: ServiceTag[];
  seconds: number;
  units: number;
  cycleLabel?: string;
  metrics: GoalMetric[];
};

type AnnualCycleRange = {
  start: Date;
  end: Date;
};

function createEmptyServiceTotals(serviceType: ServiceType): ServiceTotals {
  return {
    id: serviceType.id,
    name: serviceType.name,
    color: serviceType.color,
    icon: serviceType.icon,
    entryType: serviceType.entry_type,
    seconds: 0,
    count: 0,
    units: 0,
    unitsCount: 0,
  };
}

function aggregateServiceEntries(entries: TimeEntry[], serviceType: ServiceType): ServiceTotals {
  return entries.reduce((totals, entry) => {
    if (isUnitsEntry(entry)) {
      totals.units += entry.units_quantity ?? 0;
      totals.unitsCount += 1;
    } else {
      totals.seconds += computeDurationSeconds(entry);
      totals.count += 1;
    }

    return totals;
  }, createEmptyServiceTotals(serviceType));
}

function filterEntriesByMonth(entries: TimeEntry[], referenceDate: Date) {
  const month = referenceDate.getMonth() + 1;
  const year = referenceDate.getFullYear();

  return entries.filter((entry) => {
    const entryDate = new Date(entry.start_time);
    return entryDate.getFullYear() === year && entryDate.getMonth() + 1 === month;
  });
}

function filterEntriesByRange(entries: TimeEntry[], range: AnnualCycleRange) {
  const startTime = range.start.getTime();
  const endTime = range.end.getTime();

  return entries.filter((entry) => {
    const entryTime = new Date(entry.start_time).getTime();
    return entryTime >= startTime && entryTime <= endTime;
  });
}

function getAnnualCycleRange(referenceDate: Date, startMonth: number): AnnualCycleRange {
  const referenceMonth = referenceDate.getMonth() + 1;
  const referenceYear = referenceDate.getFullYear();
  const cycleStartYear = referenceMonth < startMonth ? referenceYear - 1 : referenceYear;
  const start = startOfMonth(new Date(cycleStartYear, startMonth - 1, 1));
  const end = endOfMonth(new Date(cycleStartYear + 1, startMonth - 2, 1));

  return { start, end };
}

function formatAnnualCycleLabel(range: AnnualCycleRange, language: "en" | "es") {
  return `${monthShortYear(range.start, language)} - ${monthShortYear(range.end, language)}`;
}

function countWorkedDays(entries: TimeEntry[]) {
  return new Set(entries.map((entry) => calendarDateKey(entry.start_time))).size;
}

function sumAllServiceTotals(serviceTotals: ServiceTotals[]) {
  return serviceTotals.reduce(
    (sum, serviceTotal) => ({
      seconds: sum.seconds + serviceTotal.seconds,
      units: sum.units + serviceTotal.units,
      entries: sum.entries + serviceTotal.count + serviceTotal.unitsCount,
    }),
    { seconds: 0, units: 0, entries: 0 }
  );
}

function hasPeriodGoal(goal: GoalDefinition | undefined, period: "month" | "year") {
  if (!goal) return false;

  return period === "month"
    ? Boolean(goal.monthly_duration_seconds || goal.monthly_units_quantity)
    : Boolean(goal.yearly_duration_seconds || goal.yearly_units_quantity);
}

function buildGradientFill(colors: string[], fallback: string) {
  const palette = [...new Set(colors.filter(Boolean))];

  if (palette.length === 0) return fallback;
  if (palette.length === 1) return palette[0];

  const lastIndex = palette.length - 1;

  return `linear-gradient(90deg, ${palette
    .map((color, index) => `${color} ${(index / lastIndex) * 100}%`)
    .join(", ")})`;
}

function buildContributionPercent(actualSeconds: number, totalSeconds: number) {
  if (actualSeconds <= 0 || totalSeconds <= 0) {
    return 0;
  }

  return Math.min(100, (actualSeconds / totalSeconds) * 100);
}

function isDefined<T>(value: T | null): value is T {
  return value !== null;
}

function buildGoalMetrics(
  goal: GoalDefinition | undefined,
  period: "month" | "year",
  actual: { seconds: number; units: number },
  fill: string
): GoalMetric[] {
  if (!goal) return [];

  const durationGoal = period === "month" ? goal.monthly_duration_seconds : goal.yearly_duration_seconds;
  const unitsGoal = period === "month" ? goal.monthly_units_quantity : goal.yearly_units_quantity;

  return [
    durationGoal
      ? {
          kind: "duration" as const,
          actual: actual.seconds,
          goal: durationGoal,
          percent: (actual.seconds / durationGoal) * 100,
          fill,
          opacity: 1,
          showBar: true,
        }
      : null,
    unitsGoal
      ? {
          kind: "units" as const,
          actual: actual.units,
          goal: unitsGoal,
          percent: (actual.units / unitsGoal) * 100,
          fill,
          opacity: 0.65,
          showBar: false,
        }
      : null,
  ].filter((metric): metric is GoalMetric => Boolean(metric));
}

function summarizeGoalMetrics(metrics: GoalMetric[]): GoalSummary | null {
  if (metrics.length === 0) {
    return null;
  }

  const completedCount = metrics.filter((metric) => metric.actual >= metric.goal).length;

  return {
    overallPercent: Math.round(Math.min(...metrics.map((metric) => metric.percent))),
    completedCount,
    totalCount: metrics.length,
    isComplete: completedCount === metrics.length,
  };
}

function formatProgressValue(kind: GoalMetric["kind"], value: number, unitsLabel: string) {
  return kind === "duration" ? formatDuration(value) : `${value} ${unitsLabel}`;
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function sortServiceTotals(serviceTotals: ServiceTotals[]) {
  return [...serviceTotals].sort(
    (left, right) => right.seconds - left.seconds || right.units - left.units || left.name.localeCompare(right.name)
  );
}

function sumGoalEntries(entries: TimeEntry[], serviceTypes: ServiceType[], serviceTypeIds: string[]) {
  const allowedServiceIds = new Set(serviceTypeIds);
  const serviceTypeMap = new Map(serviceTypes.map((serviceType) => [serviceType.id, serviceType]));
  const serviceTags: ServiceTag[] = serviceTypeIds
    .map((serviceTypeId) => serviceTypeMap.get(serviceTypeId))
    .filter((serviceType): serviceType is ServiceType => Boolean(serviceType))
    .map((serviceType) => ({
      id: serviceType.id,
      name: serviceType.name,
      color: serviceType.color,
      icon: serviceType.icon,
    }));

  return entries.reduce(
    (sum, entry) => {
      if (!allowedServiceIds.has(entry.service_type_id)) {
        return sum;
      }

      if (isUnitsEntry(entry)) {
        sum.units += entry.units_quantity ?? 0;
      } else {
        sum.seconds += computeDurationSeconds(entry);
      }

      return sum;
    },
    {
      seconds: 0,
      units: 0,
      serviceTags,
    }
  );
}

export default function ReportsPage() {
  const { t, language } = useT();
  const currentDate = useStore((s) => s.uiState.viewedMonth);
  const goToPreviousViewedMonth = useStore((s) => s.goToPreviousViewedMonth);
  const goToNextViewedMonth = useStore((s) => s.goToNextViewedMonth);
  const goToToday = useStore((s) => s.goToToday);
  const timeEntries = useStore((s) => s.timeEntries);
  const serviceTypes = useStore((s) => s.serviceTypes);
  const goals = useStore((s) => s.goals);
  const accentColor = useStore((s) => s.settings.accentColor);
  const showYearTotals = useStore((s) => s.settings.showYearTotals);

  const monthlyEntries = useMemo(
    () => filterEntriesByMonth(timeEntries, currentDate),
    [currentDate, timeEntries]
  );

  const serviceGoalMap = useMemo(
    () => new Map(
      goals
        .filter((goal) => goal.scope === "service" && goal.service_type_id)
        .map((goal) => [goal.service_type_id as string, goal])
    ),
    [goals]
  );

  const combinedGoals = useMemo(
    () => goals.filter((goal) => goal.scope === "combined"),
    [goals]
  );

  const monthlyServiceTotals = useMemo(
    () => sortServiceTotals(
      serviceTypes
        .map((serviceType) => {
          const goal = serviceGoalMap.get(serviceType.id);
          const totals = aggregateServiceEntries(
            monthlyEntries.filter((entry) => entry.service_type_id === serviceType.id),
            serviceType
          );

          return {
            totals,
            hasGoal: hasPeriodGoal(goal, "month"),
          };
        })
        .filter(({ totals, hasGoal }) => totals.seconds > 0 || totals.units > 0 || totals.count > 0 || totals.unitsCount > 0 || hasGoal)
        .map(({ totals }) => totals)
    ),
    [monthlyEntries, serviceGoalMap, serviceTypes]
  );

  const monthlyTotals = useMemo(
    () => sumAllServiceTotals(monthlyServiceTotals),
    [monthlyServiceTotals]
  );

  const monthlyDaysWorked = useMemo(
    () => countWorkedDays(monthlyEntries),
    [monthlyEntries]
  );

  const monthlyCombinedGoalCards = useMemo(
    () => combinedGoals
      .filter((goal) => hasPeriodGoal(goal, "month"))
      .map((goal) => {
        const totals = sumGoalEntries(monthlyEntries, serviceTypes, goal.service_type_ids);
        if (totals.serviceTags.length === 0) {
          return null;
        }

        return {
          goal,
          serviceTags: totals.serviceTags,
          seconds: totals.seconds,
          units: totals.units,
          metrics: buildGoalMetrics(
            goal,
            "month",
            totals,
            buildGradientFill(totals.serviceTags.map((serviceTag) => serviceTag.color), accentColor)
          ),
        } satisfies CombinedGoalCardData;
      })
      .filter(isDefined),
    [accentColor, combinedGoals, monthlyEntries, serviceTypes]
  );

  const annualBaselineRange = useMemo(
    () => getAnnualCycleRange(currentDate, 9),
    [currentDate]
  );
  const annualBaselineLabel = useMemo(
    () => formatAnnualCycleLabel(annualBaselineRange, language),
    [annualBaselineRange, language]
  );
  const annualBaselineEntries = useMemo(
    () => filterEntriesByRange(timeEntries, annualBaselineRange),
    [annualBaselineRange, timeEntries]
  );
  const annualBaselineTotals = useMemo(
    () => sumAllServiceTotals(
      serviceTypes.map((serviceType) =>
        aggregateServiceEntries(
          annualBaselineEntries.filter((entry) => entry.service_type_id === serviceType.id),
          serviceType
        )
      )
    ),
    [annualBaselineEntries, serviceTypes]
  );

  const yearlyServiceTotals = useMemo(
    () => sortServiceTotals(
      serviceTypes
        .map((serviceType) => {
          const goal = serviceGoalMap.get(serviceType.id);
          const cycleRange = getAnnualCycleRange(currentDate, goal?.yearly_start_month ?? 9);
          const totals = aggregateServiceEntries(
            filterEntriesByRange(
              timeEntries.filter((entry) => entry.service_type_id === serviceType.id),
              cycleRange
            ),
            serviceType
          );

          return {
            totals,
            hasGoal: hasPeriodGoal(goal, "year"),
          };
        })
        .filter(({ totals, hasGoal }) => totals.seconds > 0 || totals.units > 0 || totals.count > 0 || totals.unitsCount > 0 || hasGoal)
        .map(({ totals }) => totals)
    ),
    [currentDate, serviceGoalMap, serviceTypes, timeEntries]
  );

  const yearlyCombinedGoalCards = useMemo(
    () => combinedGoals
      .filter((goal) => hasPeriodGoal(goal, "year"))
      .map((goal) => {
        const cycleRange = getAnnualCycleRange(currentDate, goal.yearly_start_month);
        const totals = sumGoalEntries(filterEntriesByRange(timeEntries, cycleRange), serviceTypes, goal.service_type_ids);
        if (totals.serviceTags.length === 0) {
          return null;
        }

        return {
          goal,
          serviceTags: totals.serviceTags,
          seconds: totals.seconds,
          units: totals.units,
          cycleLabel: formatAnnualCycleLabel(cycleRange, language),
          metrics: buildGoalMetrics(
            goal,
            "year",
            totals,
            buildGradientFill(totals.serviceTags.map((serviceTag) => serviceTag.color), accentColor)
          ),
        } satisfies CombinedGoalCardData;
      })
      .filter(isDefined),
    [accentColor, combinedGoals, currentDate, language, serviceTypes, timeEntries]
  );

  const monthlyTimeServices = monthlyServiceTotals.filter((serviceTotal) => serviceTotal.entryType === "time");
  const monthlyUnitServices = monthlyServiceTotals.filter((serviceTotal) => serviceTotal.entryType === "units");
  const yearlyTimeServices = yearlyServiceTotals.filter((serviceTotal) => serviceTotal.entryType === "time");
  const yearlyUnitServices = yearlyServiceTotals.filter((serviceTotal) => serviceTotal.entryType === "units");

  return (
    <>
      <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-surface/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPreviousViewedMonth}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <h2 className="text-lg md:text-xl font-bold min-w-[10rem] text-center">
            {monthShortYear(currentDate, language)}
          </h2>
          <button
            onClick={goToNextViewedMonth}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
          <button
            onClick={goToToday}
            className="ml-2 px-3 py-1.5 text-xs font-bold bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
          >
            {t("calendar.today")}
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6 bg-canvas">
        <div className={`grid grid-cols-2 ${monthlyTotals.units > 0 ? "md:grid-cols-5" : "md:grid-cols-4"} gap-4`}>
          {[
            { label: t("reports.totalHours"), value: formatDuration(monthlyTotals.seconds), icon: "schedule" },
            { label: t("reports.daysWorked"), value: monthlyDaysWorked.toString(), icon: "calendar_today" },
            { label: t("reports.totalEntries"), value: monthlyTotals.entries.toString(), icon: "list_alt" },
            { label: t("reports.avgDay"), value: monthlyDaysWorked > 0 ? formatDuration(Math.round(monthlyTotals.seconds / monthlyDaysWorked)) : "-", icon: "trending_up" },
            ...(monthlyTotals.units > 0
              ? [{ label: t("reports.totalUnits"), value: monthlyTotals.units.toString(), icon: "pin" }]
              : []),
          ].map(({ label, value, icon }) => (
            <SummaryCard key={label} label={label} value={value} icon={icon} />
          ))}
        </div>

        <div className="bg-gradient-to-br from-surface via-surface to-slate-50/70 dark:to-slate-950/30 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div>
            <h3 className="font-bold text-lg">{t("reports.byServiceType")}</h3>
            <p className="text-sm text-slate-400">{t("reports.servicesGroupedByEntryType")}</p>
          </div>

          {monthlyServiceTotals.length === 0 ? (
            <p className="text-slate-400 text-center py-8">{t("reports.noData")}</p>
          ) : (
            <div className="space-y-5">
              {monthlyTimeServices.length > 0 && (
                <ServiceGroupSection title={t("reports.timeServices")} description={t("reports.timeServicesDesc")}>
                  {monthlyTimeServices.map((serviceTotal) => (
                    <ServiceTotalsCard
                      key={serviceTotal.id}
                      serviceTotal={serviceTotal}
                      goal={serviceGoalMap.get(serviceTotal.id)}
                      period="month"
                      showContributionBar
                      comparisonSeconds={monthlyTotals.seconds}
                    />
                  ))}
                </ServiceGroupSection>
              )}

              {monthlyUnitServices.length > 0 && (
                <ServiceGroupSection title={t("reports.unitServices")} description={t("reports.unitServicesDesc")}>
                  {monthlyUnitServices.map((serviceTotal) => (
                    <ServiceTotalsCard
                      key={serviceTotal.id}
                      serviceTotal={serviceTotal}
                      goal={serviceGoalMap.get(serviceTotal.id)}
                      period="month"
                    />
                  ))}
                </ServiceGroupSection>
              )}
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-surface via-surface to-slate-50/70 dark:to-slate-950/30 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-bold text-lg">{t("reports.monthlyCombinedTotals")}</h3>
              <p className="text-sm text-slate-400">{t("reports.allServicesCombined")}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {monthShortYear(currentDate, language)}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <MetricTile label={t("reports.totalHours")} value={formatDuration(monthlyTotals.seconds)} icon="schedule" color={accentColor} />
            <MetricTile label={t("reports.totalUnits")} value={`${monthlyTotals.units} ${t("calendar.units")}`} icon="pin" color={accentColor} />
          </div>

          <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-6">
            <div className="flex items-center justify-between gap-3">
              <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">{t("settings.combinedGoals")}</h4>
            </div>

            {monthlyCombinedGoalCards.length === 0 ? (
              <p className="text-sm text-slate-400">{t("reports.noCombinedGoals")}</p>
            ) : (
              <div className="space-y-3">
                {monthlyCombinedGoalCards.map((goalCard) => (
                  <CombinedGoalProgressCard
                    key={goalCard.goal.id}
                    title={goalCard.goal.name}
                    serviceTags={goalCard.serviceTags}
                    seconds={goalCard.seconds}
                    units={goalCard.units}
                    metrics={goalCard.metrics}
                    period="month"
                    accentColor={accentColor}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {showYearTotals && (
          <div className="bg-gradient-to-br from-surface via-surface to-slate-50/70 dark:to-slate-950/30 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-bold text-lg">{t("reports.annualCycleTotals")}</h3>
                <p className="text-sm text-slate-400">{t("reports.activeAnnualCycle")}</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {annualBaselineLabel}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricTile label={t("reports.totalHours")} value={formatDuration(annualBaselineTotals.seconds)} icon="schedule" color={accentColor} />
              <MetricTile label={t("reports.totalUnits")} value={`${annualBaselineTotals.units} ${t("calendar.units")}`} icon="pin" color={accentColor} />
            </div>

            <div className="space-y-5">
              {yearlyTimeServices.length > 0 && (
                <ServiceGroupSection title={t("reports.timeServices")} description={t("reports.annualServiceCycleDesc")}>
                  {yearlyTimeServices.map((serviceTotal) => (
                    <ServiceTotalsCard
                      key={`year-${serviceTotal.id}`}
                      serviceTotal={serviceTotal}
                      goal={serviceGoalMap.get(serviceTotal.id)}
                      period="year"
                      cycleLabel={formatAnnualCycleLabel(getAnnualCycleRange(currentDate, serviceGoalMap.get(serviceTotal.id)?.yearly_start_month ?? 9), language)}
                    />
                  ))}
                </ServiceGroupSection>
              )}

              {yearlyUnitServices.length > 0 && (
                <ServiceGroupSection title={t("reports.unitServices")} description={t("reports.annualServiceCycleDesc")}>
                  {yearlyUnitServices.map((serviceTotal) => (
                    <ServiceTotalsCard
                      key={`year-${serviceTotal.id}`}
                      serviceTotal={serviceTotal}
                      goal={serviceGoalMap.get(serviceTotal.id)}
                      period="year"
                      cycleLabel={formatAnnualCycleLabel(getAnnualCycleRange(currentDate, serviceGoalMap.get(serviceTotal.id)?.yearly_start_month ?? 9), language)}
                    />
                  ))}
                </ServiceGroupSection>
              )}
            </div>

            <div className="border-t border-slate-100 dark:border-slate-800 pt-6 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">{t("settings.combinedGoals")}</h4>
              </div>

              {yearlyCombinedGoalCards.length === 0 ? (
                <p className="text-sm text-slate-400">{t("reports.noCombinedGoals")}</p>
              ) : (
                <div className="space-y-3">
                  {yearlyCombinedGoalCards.map((goalCard) => (
                    <CombinedGoalProgressCard
                      key={`year-${goalCard.goal.id}`}
                      title={goalCard.goal.name}
                      serviceTags={goalCard.serviceTags}
                      seconds={goalCard.seconds}
                      units={goalCard.units}
                      metrics={goalCard.metrics}
                      period="year"
                      cycleLabel={goalCard.cycleLabel}
                      accentColor={accentColor}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-surface via-surface to-slate-50/70 dark:to-slate-950/20 p-4 shadow-sm">
      <div className="absolute -right-5 -top-5 size-20 rounded-full bg-primary/10" />
      <div className="relative flex items-center gap-2 text-slate-400 mb-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <span className="material-symbols-outlined text-base">{icon}</span>
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="relative text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-950/20 p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        <span className="flex size-8 items-center justify-center rounded-xl bg-white dark:bg-slate-900 shadow-sm">
          <span className="material-symbols-outlined text-base">{icon}</span>
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function ServiceGroupSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h4 className="font-semibold text-sm text-slate-500 uppercase tracking-wide">{title}</h4>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ServiceTotalsCard({
  serviceTotal,
  goal,
  period,
  cycleLabel,
  showContributionBar,
  comparisonSeconds,
}: {
  serviceTotal: ServiceTotals;
  goal?: GoalDefinition;
  period: "month" | "year";
  cycleLabel?: string;
  showContributionBar?: boolean;
  comparisonSeconds?: number;
}) {
  const { t } = useT();
  const metrics = buildGoalMetrics(goal, period, serviceTotal, serviceTotal.color);
  const goalSummary = summarizeGoalMetrics(metrics);
  const durationMetric = metrics.find((metric) => metric.kind === "duration");
  const unitsMetric = metrics.find((metric) => metric.kind === "units");
  const contributionPercent = showContributionBar
    ? buildContributionPercent(serviceTotal.seconds, comparisonSeconds ?? 0)
    : 0;
  const totalEntries = serviceTotal.count + serviceTotal.unitsCount;
  const showCelebration = period === "month" && Boolean(goalSummary?.isComplete);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-950/20 p-4 shadow-sm space-y-3">
      {showCelebration && <GoalSeal label={t("reports.wellDone")} />}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="size-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: serviceTotal.color + "1a" }}
          >
            <span className="material-symbols-outlined text-lg" style={{ color: serviceTotal.color }}>
              {serviceTotal.icon}
            </span>
          </div>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold text-sm truncate">{serviceTotal.name}</p>
            <div className="flex flex-wrap gap-2">
              {goal && (
                <span className="inline-flex items-center rounded-full bg-slate-200/70 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {goal.name}
                </span>
              )}
              {cycleLabel && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                  {cycleLabel}
                </span>
              )}
              {totalEntries > 0 && (
                <span className="text-xs text-slate-400">{totalEntries} {t("reports.entries")}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-2 shrink-0 text-right">
          {durationMetric ? (
            <GoalValuePill
              label={t("settings.goalHours")}
              value={`${formatProgressValue("duration", durationMetric.actual, t("calendar.units"))} / ${formatProgressValue("duration", durationMetric.goal, t("calendar.units"))}`}
              accentColor={serviceTotal.color}
            />
          ) : serviceTotal.seconds > 0 ? (
            <GoalValuePill
              label={t("settings.goalHours")}
              value={formatDuration(serviceTotal.seconds)}
              accentColor={serviceTotal.color}
            />
          ) : null}

          {unitsMetric ? (
            <GoalValuePill
              label={t("settings.goalUnits")}
              value={`${formatProgressValue("units", unitsMetric.actual, t("calendar.units"))} / ${formatProgressValue("units", unitsMetric.goal, t("calendar.units"))}`}
              accentColor={serviceTotal.color}
            />
          ) : serviceTotal.units > 0 ? (
            <GoalValuePill
              label={t("settings.goalUnits")}
              value={`${serviceTotal.units} ${t("calendar.units")}`}
              accentColor={serviceTotal.color}
            />
          ) : null}
        </div>
      </div>

      {goalSummary && (
        <GoalSummaryRow summary={goalSummary} showCelebration={showCelebration} />
      )}

      {showContributionBar && serviceTotal.entryType === "time" && contributionPercent > 0 && (
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${contributionPercent}%`, background: serviceTotal.color }}
          />
        </div>
      )}

      {metrics.length > 0 && (
        <div className="space-y-2">
          {metrics.map((metric) => (
            <GoalMetricRow key={metric.kind} metric={metric} accentColor={serviceTotal.color} />
          ))}
        </div>
      )}
    </div>
  );
}

function CombinedGoalProgressCard({
  title,
  serviceTags,
  seconds,
  units,
  metrics,
  period,
  cycleLabel,
  accentColor,
}: {
  title: string;
  serviceTags: ServiceTag[];
  seconds: number;
  units: number;
  metrics: GoalMetric[];
  period: "month" | "year";
  cycleLabel?: string;
  accentColor: string;
}) {
  const { t } = useT();
  const goalSummary = summarizeGoalMetrics(metrics);
  const durationMetric = metrics.find((metric) => metric.kind === "duration");
  const unitsMetric = metrics.find((metric) => metric.kind === "units");
  const showCelebration = period === "month" && Boolean(goalSummary?.isComplete);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-950/20 p-4 shadow-sm space-y-3">
      {showCelebration && <GoalSeal label={t("reports.wellDone")} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="material-symbols-outlined text-base" style={{ color: accentColor }}>flag</span>
            <p className="font-semibold text-sm truncate">{title}</p>
            {cycleLabel && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                {cycleLabel}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {serviceTags.map((serviceTag) => (
              <span
                key={serviceTag.id}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                style={{ backgroundColor: serviceTag.color + "1a", color: serviceTag.color }}
              >
                <span className="material-symbols-outlined text-sm">{serviceTag.icon}</span>
                <span>{serviceTag.name}</span>
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-2 shrink-0 text-right">
          {durationMetric ? (
            <GoalValuePill
              label={t("settings.goalHours")}
              value={`${formatProgressValue("duration", durationMetric.actual, t("calendar.units"))} / ${formatProgressValue("duration", durationMetric.goal, t("calendar.units"))}`}
              accentColor={accentColor}
            />
          ) : seconds > 0 ? (
            <GoalValuePill
              label={t("settings.goalHours")}
              value={formatDuration(seconds)}
              accentColor={accentColor}
            />
          ) : null}

          {unitsMetric ? (
            <GoalValuePill
              label={t("settings.goalUnits")}
              value={`${formatProgressValue("units", unitsMetric.actual, t("calendar.units"))} / ${formatProgressValue("units", unitsMetric.goal, t("calendar.units"))}`}
              accentColor={accentColor}
            />
          ) : units > 0 ? (
            <GoalValuePill
              label={t("settings.goalUnits")}
              value={`${units} ${t("calendar.units")}`}
              accentColor={accentColor}
            />
          ) : null}
        </div>
      </div>

      {goalSummary && (
        <GoalSummaryRow summary={goalSummary} showCelebration={showCelebration} />
      )}

      {metrics.length > 0 && (
        <div className="space-y-2">
          {metrics.map((metric) => (
            <GoalMetricRow key={metric.kind} metric={metric} accentColor={accentColor} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalValuePill({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-950/40 px-3 py-2 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-bold" style={{ color: accentColor }}>
        {value}
      </p>
    </div>
  );
}

function GoalSeal({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute right-[-3.85rem] top-5 rotate-[31deg]">
      <div className="min-w-[12rem] border border-white/20 bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-1.5 text-center text-[10px] font-black uppercase tracking-[0.28em] text-white shadow-lg">
        {label}
      </div>
    </div>
  );
}

function GoalSummaryRow({
  summary,
  showCelebration,
}: {
  summary: GoalSummary;
  showCelebration?: boolean;
}) {
  const { t } = useT();

  return (
    <div
      className={showCelebration
        ? "rounded-2xl border border-emerald-200 bg-emerald-50/90 px-3 py-3 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
        : "rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/40 px-3 py-3 text-slate-600 dark:text-slate-200"}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-base">
            {showCelebration ? "verified" : "monitoring"}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.18em]">
              {showCelebration ? t("reports.monthlyGoalAchieved") : t("reports.goalProgress")}
            </p>
            <p className="text-xs opacity-80">
              {summary.completedCount}/{summary.totalCount} {t("reports.targetsCleared")}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white/80 dark:bg-slate-950/60 px-2.5 py-1 text-xs font-bold shadow-sm">
          {formatPercent(summary.overallPercent)}
        </span>
      </div>
    </div>
  );
}

function GoalMetricRow({ metric, accentColor }: { metric: GoalMetric; accentColor: string }) {
  const { t } = useT();

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/20 px-3 py-3 shadow-sm space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {metric.kind === "duration" ? t("settings.goalHours") : t("settings.goalUnits")}
          </p>
          <p className="mt-1 text-sm font-semibold" style={{ color: accentColor }}>
            {formatProgressValue(metric.kind, metric.actual, t("calendar.units"))} / {formatProgressValue(metric.kind, metric.goal, t("calendar.units"))}
          </p>
        </div>
        <span
          className={metric.percent >= 100
            ? "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200"
            : "rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-200"}
        >
          {formatPercent(metric.percent)}
        </span>
      </div>

      {metric.showBar && (
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.min(100, metric.percent)}%`, background: metric.fill, opacity: metric.opacity }}
          />
        </div>
      )}
    </div>
  );
}
