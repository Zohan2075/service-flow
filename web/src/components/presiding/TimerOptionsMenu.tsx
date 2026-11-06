"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { useTheme } from "@/components/ThemeProvider";
import { getTimeZoneOptions, humanizeTimeZone } from "@/lib/timeFormat";
import { cn } from "@/lib/utils";
import type { TimerFontScale, TimerPrecision } from "@/types/data";

export type TimerMenuMode = "stopwatch" | "countdown" | "clock";

interface TimerOptionsMenuProps {
  open: boolean;
  onClose: () => void;
  mode: TimerMenuMode;
  isFullscreen?: boolean;
  onOpenFullscreen?: () => void;
  onExitFullscreen?: () => void;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors motion-reduce:transition-none",
        checked ? "bg-primary" : "bg-slate-300 dark:bg-slate-600",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none",
          checked ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex shrink-0 rounded-xl border border-slate-200 p-0.5 dark:border-slate-700"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-bold transition-colors motion-reduce:transition-none",
            value === option.value
              ? "bg-primary text-white"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</p>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/**
 * One options menu shared by the Time cards and the fullscreen overlay.
 * Mode-aware: only the settings that apply to the current timer are shown.
 * Rendered through a portal so a transformed ancestor cannot offset it.
 */
export default function TimerOptionsMenu({
  open,
  onClose,
  mode,
  isFullscreen = false,
  onOpenFullscreen,
  onExitFullscreen,
}: TimerOptionsMenuProps) {
  const { t } = useT();
  const prefs = useStore((s) => s.timeTools.timerPrefs);
  const setTimerPrefs = useStore((s) => s.setTimerPrefs);
  const timeFormat = useStore((s) => s.presidingPrefs.timeFormat);
  const setPresidingPrefs = useStore((s) => s.setPresidingPrefs);
  const countryTz = useStore((s) => s.timeTools.countryTz);
  const setCountryClock = useStore((s) => s.setCountryClock);
  const { theme, setTheme } = useTheme();
  const zoneOptions = useMemo(() => getTimeZoneOptions(), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const title =
    mode === "stopwatch" ? t("time.stopwatch") : mode === "countdown" ? t("time.countdown") : t("time.countryClock");

  const precisionOptions: { value: TimerPrecision; label: string }[] = [
    { value: "s", label: t("time.precisionSeconds") },
    { value: "cs", label: t("time.precisionCentiseconds") },
    { value: "ms", label: t("time.precisionMilliseconds") },
  ];
  const fontOptions: { value: TimerFontScale; label: string }[] = [
    { value: "compact", label: t("time.fontCompact") },
    { value: "normal", label: t("time.fontNormal") },
    { value: "large", label: t("time.fontLarge") },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center" role="presentation">
      <button
        type="button"
        aria-label={t("time.hide")}
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("time.options")}
        className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-slate-200 bg-surface p-5 shadow-2xl dark:border-slate-700 md:w-[430px] md:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {t("time.options")}
            </p>
            <p className="text-lg font-black text-slate-700 dark:text-slate-100">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("time.hide")}
            className="flex size-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <Section title={t("time.menuDisplay")}>
          {mode === "clock" && (
            <>
              <Row label={t("time.format")}>
                <Segmented
                  value={timeFormat}
                  options={[
                    { value: "12h", label: t("time.hours12") },
                    { value: "24h", label: t("time.hours24") },
                  ]}
                  onChange={(value) => setPresidingPrefs({ timeFormat: value })}
                  label={t("time.format")}
                />
              </Row>
              <Row label={t("time.showSeconds")}>
                <Toggle
                  checked={prefs.showSeconds}
                  onChange={(value) => setTimerPrefs({ showSeconds: value })}
                  label={t("time.showSeconds")}
                />
              </Row>
              <Row label={t("time.showDate")}>
                <Toggle
                  checked={prefs.showDate}
                  onChange={(value) => setTimerPrefs({ showDate: value })}
                  label={t("time.showDate")}
                />
              </Row>
              <Row label={t("time.changeTz")}>
                <select
                  value={countryTz ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setCountryClock(value || null, value ? humanizeTimeZone(value) : null);
                  }}
                  aria-label={t("time.changeTz")}
                  className="max-w-[190px] rounded-lg border border-slate-200 bg-surface px-2 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:text-slate-200"
                >
                  <option value="">{t("time.deviceZone")}</option>
                  {zoneOptions.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </Row>
            </>
          )}
          {mode === "stopwatch" && (
            <Row label={t("time.precision")}>
              <Segmented
                value={prefs.precision}
                options={precisionOptions}
                onChange={(value) => setTimerPrefs({ precision: value })}
                label={t("time.precision")}
              />
            </Row>
          )}
          <Row label={t("time.fontSize")}>
            <Segmented
              value={prefs.fontScale}
              options={fontOptions}
              onChange={(value) => setTimerPrefs({ fontScale: value })}
              label={t("time.fontSize")}
            />
          </Row>
          <Row label={t("settings.theme")}>
            <Segmented
              value={theme}
              options={[
                { value: "light", label: t("settings.light") },
                { value: "dark", label: t("settings.dark") },
                { value: "system", label: t("settings.system") },
              ]}
              onChange={setTheme}
              label={t("settings.theme")}
            />
          </Row>
        </Section>

        <Section title={t("time.menuBehavior")}>
          <Row label={t("time.keepAwake")}>
            <Toggle
              checked={prefs.keepAwake}
              onChange={(value) => setTimerPrefs({ keepAwake: value })}
              label={t("time.keepAwake")}
            />
          </Row>
          <Row label={t("time.sound")}>
            <Toggle
              checked={prefs.sound}
              onChange={(value) => setTimerPrefs({ sound: value })}
              label={t("time.sound")}
            />
          </Row>
          <Row label={t("time.haptics")}>
            <Toggle
              checked={prefs.haptics}
              onChange={(value) => setTimerPrefs({ haptics: value })}
              label={t("time.haptics")}
            />
          </Row>
        </Section>

        <Section title={t("time.menuView")}>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (isFullscreen) onExitFullscreen?.();
              else onOpenFullscreen?.();
            }}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-white transition-opacity hover:opacity-90 motion-reduce:transition-none"
          >
            <span className="material-symbols-outlined text-lg">
              {isFullscreen ? "fullscreen_exit" : "fullscreen"}
            </span>
            {isFullscreen ? t("time.exitFullscreen") : t("time.fullscreen")}
          </button>
        </Section>

        <Section title={t("time.menuShortcuts")}>
          <ul className="mt-1 space-y-1 text-xs text-slate-500 dark:text-slate-400">
            {[
              { label: t("time.shortcutStartPause"), key: "Space" },
              { label: t("time.shortcutLap"), key: "L" },
              { label: t("time.shortcutReset"), key: "R" },
              { label: t("time.shortcutFullscreen"), key: "F" },
              { label: t("time.shortcutMenu"), key: "M" },
            ].map((item) => (
              <li key={item.key} className="flex items-center justify-between gap-3">
                <span>{item.label}</span>
                <kbd className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {item.key}
                </kbd>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>,
    document.body,
  );
}
