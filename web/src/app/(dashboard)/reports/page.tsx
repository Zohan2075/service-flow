"use client";

import { useMemo, useState } from "react";
import { subMonths } from "date-fns";
import { useStore } from "@/lib/store";
import { calendarDateKey, computeDurationSeconds, isUnitsEntry } from "@/types/data";
import type { GoalDefinition, ServiceType, TimeEntry } from "@/types/data";
import { formatDuration } from "@/lib/utils";
import { useT, monthShortYear } from "@/lib/i18n";

type ServiceTotals = {
  id: string;
  name: string;
  color: string;
  icon: string;
  seconds: number;
  count: number;
  units: number;
  unitsCount: number;
};

type ProgressBar = {
  kind: "duration" | "units";
  actual: number;
  goal: number;
  percent: number;
  fill: string;
  opacity: number;
};

type ServiceTag = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

function filterEntriesByMonth(entries: TimeEntry[], year: number, month: number) {
  return entries.filter((entry) => {
    const entryDate = new Date(entry.start_time);
    return entryDate.getFullYear() === year && entryDate.getMonth() + 1 === month;
  });
}

function filterEntriesByYear(entries: TimeEntry[], year: number) {
  return entries.filter((entry) => new Date(entry.start_time).getFullYear() === year);
}

function aggregateByService(entries: TimeEntry[], serviceTypes: ServiceType[]): ServiceTotals[] {
  const serviceTypeMap = new Map(serviceTypes.map((serviceType) => [serviceType.id, serviceType]));
  const totalsMap = new Map<string, ServiceTotals>();

  for (const entry of entries) {
    const serviceType = serviceTypeMap.get(entry.service_type_id);
    const current = totalsMap.get(entry.service_type_id) ?? {
      id: entry.service_type_id,
      name: serviceType?.name ?? "Unknown",
      color: serviceType?.color ?? "#2094f3",
      icon: serviceType?.icon ?? "work",
      seconds: 0,
      count: 0,
      units: 0,
      unitsCount: 0,
    };

    if (isUnitsEntry(entry)) {
      current.units += entry.units_quantity ?? 0;
      current.unitsCount += 1;
    } else {
      current.seconds += computeDurationSeconds(entry);
      current.count += 1;
    }

    totalsMap.set(entry.service_type_id, current);
  }

  return [...totalsMap.values()].sort((left, right) =>
    right.seconds - left.seconds || right.units - left.units || left.name.localeCompare(right.name)
  );
}

function buildTotalsMap(serviceTotals: ServiceTotals[]) {
  return new Map(serviceTotals.map((serviceTotal) => [serviceTotal.id, serviceTotal]));
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

function hasPeriodGoal(goal: GoalDefinition, period: "month" | "year") {
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

function buildContributionPercent(
  actual: { seconds: number; units: number },
  totals: { seconds: number; units: number }
) {
  const durationShare = actual.seconds > 0 && totals.seconds > 0 ? actual.seconds / totals.seconds : 0;
  const unitsShare = actual.units > 0 && totals.units > 0 ? actual.units / totals.units : 0;

  return Math.min(100, Math.max(durationShare, unitsShare) * 100);
}

function buildProgressBars(
  goal: GoalDefinition | undefined,
  period: "month" | "year",
  actual: { seconds: number; units: number },
  fill: string
): ProgressBar[] {
  if (!goal) return [];

  const durationGoal = period === "month" ? goal.monthly_duration_seconds : goal.yearly_duration_seconds;
  const unitsGoal = period === "month" ? goal.monthly_units_quantity : goal.yearly_units_quantity;

  return [
    durationGoal
      ? {
          kind: "duration" as const,
          actual: actual.seconds,
          goal: durationGoal,
          percent: Math.min(100, (actual.seconds / durationGoal) * 100),
          fill,
          opacity: 1,
        }
      : null,
    unitsGoal
      ? {
          kind: "units" as const,
          actual: actual.units,
          goal: unitsGoal,
          percent: Math.min(100, (actual.units / unitsGoal) * 100),
          fill,
          opacity: 0.55,
        }
      : null,
  ].filter((bar): bar is ProgressBar => Boolean(bar));
}

function sumCombinedGoalTotals(
  goal: GoalDefinition,
  totalsMap: Map<string, ServiceTotals>,
  serviceTypes: ServiceType[]
) {
  return goal.service_type_ids.reduce(
    (sum, serviceTypeId) => {
      const serviceTotal = totalsMap.get(serviceTypeId);
      const serviceType = serviceTypes.find((currentServiceType) => currentServiceType.id === serviceTypeId);

      if (serviceType) {
        sum.serviceTags.push({
          id: serviceType.id,
          name: serviceType.name,
          color: serviceType.color,
          icon: serviceType.icon,
        });
      }

      if (serviceTotal) {
        sum.seconds += serviceTotal.seconds;
        sum.units += serviceTotal.units;
      }

      return sum;
    },
    {
      seconds: 0,
      units: 0,
      serviceTags: [] as ServiceTag[],
    }
  );
}

function formatProgressValue(kind: ProgressBar["kind"], value: number, unitsLabel: string) {
  return kind === "duration" ? formatDuration(value) : `${value} ${unitsLabel}`;
}

export default function ReportsPage() {
  const { t, language } = useT();
  const [currentDate, setCurrentDate] = useState(new Date());
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const timeEntries = useStore((s) => s.timeEntries);
  const serviceTypes = useStore((s) => s.serviceTypes);
  const goals = useStore((s) => s.goals);
  const accentColor = useStore((s) => s.settings.accentColor);
  const showYearTotals = useStore((s) => s.settings.showYearTotals);

  const monthlyEntries = useMemo(
    () => filterEntriesByMonth(timeEntries, year, month),
    [month, timeEntries, year]
  );

  const yearlyEntries = useMemo(
    () => filterEntriesByYear(timeEntries, year),
    [timeEntries, year]
  );

  const monthlyServiceTotals = useMemo(
    () => aggregateByService(monthlyEntries, serviceTypes),
    [monthlyEntries, serviceTypes]
  );

  const yearlyServiceTotals = useMemo(
    () => aggregateByService(yearlyEntries, serviceTypes),
    [serviceTypes, yearlyEntries]
  );

  const monthlyTotals = useMemo(
    () => sumAllServiceTotals(monthlyServiceTotals),
    [monthlyServiceTotals]
  );

  const yearlyTotals = useMemo(
    () => sumAllServiceTotals(yearlyServiceTotals),
    [yearlyServiceTotals]
  );

  const monthlyDaysWorked = useMemo(
    () => countWorkedDays(monthlyEntries),
    [monthlyEntries]
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

  const monthlyTotalsMap = useMemo(
    () => buildTotalsMap(monthlyServiceTotals),
    [monthlyServiceTotals]
  );

  const yearlyTotalsMap = useMemo(
    () => buildTotalsMap(yearlyServiceTotals),
    [yearlyServiceTotals]
  );

  const monthlyCombinedGoalCards = useMemo(
    () => combinedGoals
      .filter((goal) => hasPeriodGoal(goal, "month"))
      .map((goal) => {
        const totals = sumCombinedGoalTotals(goal, monthlyTotalsMap, serviceTypes);
        const barFill = buildGradientFill(
          totals.serviceTags.map((serviceTag) => serviceTag.color),
          accentColor
        );

        return {
          goal,
          ...totals,
          bars: buildProgressBars(goal, "month", totals, barFill),
        };
      })
      .filter((goalCard) => goalCard.serviceTags.length > 0),
    [accentColor, combinedGoals, monthlyTotalsMap, serviceTypes]
  );

  const yearlyCombinedGoalCards = useMemo(
    () => combinedGoals
      .filter((goal) => hasPeriodGoal(goal, "year"))
      .map((goal) => {
        const totals = sumCombinedGoalTotals(goal, yearlyTotalsMap, serviceTypes);
        const barFill = buildGradientFill(
          totals.serviceTags.map((serviceTag) => serviceTag.color),
          accentColor
        );

        return {
          goal,
          ...totals,
          bars: buildProgressBars(goal, "year", totals, barFill),
        };
      })
      .filter((goalCard) => goalCard.serviceTags.length > 0),
    [accentColor, combinedGoals, serviceTypes, yearlyTotalsMap]
  );

  return (
    <>
      <header className="flex items-center justify-between px-4 md:px-6 py-4 bg-surface/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <h2 className="text-lg md:text-xl font-bold min-w-[10rem] text-center">
            {monthShortYear(currentDate, language)}
          </h2>
          <button
            onClick={() => setCurrentDate(new Date(year, month, 1))}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 space-y-6 bg-canvas">
        <div className={`grid grid-cols-2 ${monthlyTotals.units > 0 ? "md:grid-cols-5" : "md:grid-cols-4"} gap-4`}>
          {[
            { label: t("reports.totalHours"), value: formatDuration(monthlyTotals.seconds), icon: "schedule" },
            { label: t("reports.daysWorked"), value: monthlyDaysWorked.toString(), icon: "calendar_today" },
            { label: t("reports.totalEntries"), value: monthlyTotals.entries.toString(), icon: "list_alt" },
            { label: t("reports.avgDay"), value: monthlyDaysWorked > 0 ? formatDuration(Math.round(monthlyTotals.seconds / monthlyDaysWorked)) : "—", icon: "trending_up" },
            ...(monthlyTotals.units > 0
              ? [{ label: t("reports.totalUnits"), value: monthlyTotals.units.toString(), icon: "pin" }]
              : []),
          ].map(({ label, value, icon }) => (
            <SummaryCard key={label} label={label} value={value} icon={icon} />
          ))}
        </div>

        <div className="bg-surface rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <h3 className="font-bold text-lg mb-4">{t("reports.byServiceType")}</h3>
          {monthlyServiceTotals.length === 0 ? (
            <p className="text-slate-400 text-center py-8">{t("reports.noData")}</p>
          ) : (
            <div className="space-y-3">
              {monthlyServiceTotals.map((serviceTotal) => (
                <ServiceTotalsCard
                  key={serviceTotal.id}
                  serviceTotal={serviceTotal}
                  comparisonTotals={monthlyTotals}
                  goal={serviceGoalMap.get(serviceTotal.id)}
                  period="month"
                  showGoalBars={showYearTotals}
                />
              ))}
            </div>
          )}
        </div>

        <div className="bg-surface rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-4">
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

          {showYearTotals && (
            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-6 space-y-3">
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
                      title={goalCard.goal.name ?? t("settings.goalDefaultName")}
                      serviceTags={goalCard.serviceTags}
                      bars={goalCard.bars}
                      seconds={goalCard.seconds}
                      units={goalCard.units}
                      accentColor={accentColor}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {showYearTotals && (
          <div className="bg-surface rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-bold text-lg">{t("reports.yearlyTotals")} — {year}</h3>
                <p className="text-sm text-slate-400">{t("reports.allServicesCombined")}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <MetricTile label={t("reports.totalHours")} value={formatDuration(yearlyTotals.seconds)} icon="schedule" color={accentColor} />
              <MetricTile label={t("reports.totalUnits")} value={`${yearlyTotals.units} ${t("calendar.units")}`} icon="pin" color={accentColor} />
            </div>

            <div className="space-y-3">
              {yearlyServiceTotals.length === 0 ? (
                <p className="text-slate-400 text-center py-4">{t("reports.noData")}</p>
              ) : (
                yearlyServiceTotals.map((serviceTotal) => (
                  <ServiceTotalsCard
                    key={`year-${serviceTotal.id}`}
                    serviceTotal={serviceTotal}
                    comparisonTotals={yearlyTotals}
                    goal={serviceGoalMap.get(serviceTotal.id)}
                    period="year"
                    showGoalBars
                  />
                ))
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
                      title={goalCard.goal.name ?? t("settings.goalDefaultName")}
                      serviceTags={goalCard.serviceTags}
                      bars={goalCard.bars}
                      seconds={goalCard.seconds}
                      units={goalCard.units}
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
    <div className="bg-surface rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        <span className="material-symbols-outlined text-base">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-primary">{value}</p>
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
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        <span className="material-symbols-outlined text-base">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function ServiceTotalsCard({
  serviceTotal,
  comparisonTotals,
  goal,
  period,
  showGoalBars,
}: {
  serviceTotal: ServiceTotals;
  comparisonTotals: { seconds: number; units: number };
  goal: GoalDefinition | undefined;
  period: "month" | "year";
  showGoalBars: boolean;
}) {
  const { t } = useT();
  const progressBars = buildProgressBars(goal, period, serviceTotal, serviceTotal.color);
  const sharePercent = buildContributionPercent(serviceTotal, comparisonTotals);
  const totalEntries = serviceTotal.count + serviceTotal.unitsCount;

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 p-4 space-y-3">
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
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{serviceTotal.name}</p>
            {totalEntries > 0 && (
              <p className="text-xs text-slate-400">{totalEntries} {t("reports.entries")}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 text-right">
          {serviceTotal.seconds > 0 && (
            <span className="text-sm font-bold" style={{ color: serviceTotal.color }}>
              {formatDuration(serviceTotal.seconds)}
            </span>
          )}
          {serviceTotal.units > 0 && (
            <span className="text-sm font-bold" style={{ color: serviceTotal.color }}>
              {serviceTotal.units} {t("calendar.units")}
            </span>
          )}
        </div>
      </div>

      {sharePercent > 0 && (
        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${sharePercent}%`, background: serviceTotal.color }}
          />
        </div>
      )}

      {showGoalBars && progressBars.length > 0 && (
        <div className="space-y-2">
          {progressBars.map((bar) => (
            <div key={bar.kind} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <span>{bar.kind === "duration" ? t("settings.goalHours") : t("settings.goalUnits")}</span>
                <span className="text-right">
                  {formatProgressValue(bar.kind, bar.actual, t("calendar.units"))} / {formatProgressValue(bar.kind, bar.goal, t("calendar.units"))}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${bar.percent}%`, background: bar.fill, opacity: bar.opacity }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CombinedGoalProgressCard({
  title,
  serviceTags,
  bars,
  seconds,
  units,
  accentColor,
}: {
  title: string;
  serviceTags: ServiceTag[];
  bars: ProgressBar[];
  seconds: number;
  units: number;
  accentColor: string;
}) {
  const { t } = useT();

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/30 p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-base" style={{ color: accentColor }}>flag</span>
            <p className="font-semibold text-sm truncate">{title}</p>
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

        <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 text-right">
          <span className="text-sm font-bold" style={{ color: accentColor }}>
            {formatDuration(seconds)}
          </span>
          <span className="text-sm font-bold" style={{ color: accentColor }}>
            {units} {t("calendar.units")}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {bars.map((bar) => (
          <div key={bar.kind} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <span>{bar.kind === "duration" ? t("settings.goalHours") : t("settings.goalUnits")}</span>
              <span className="text-right">
                {formatProgressValue(bar.kind, bar.actual, t("calendar.units"))} / {formatProgressValue(bar.kind, bar.goal, t("calendar.units"))}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${bar.percent}%`, background: bar.fill, opacity: bar.opacity }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
