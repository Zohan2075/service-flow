"use client";

import { useStore } from "@/lib/store";
import type { PresidingPrefs } from "@/types/presiding";
import { getDefaultPresidingConfig, getDefaultPresidingPrefs } from "@/types/presiding";

interface Props {
  lang: "en" | "es";
}

export default function PresidingSettings({ lang }: Props) {
  const prefs = useStore((s) => s.presidingPrefs);
  const setPrefs = useStore((s) => s.setPresidingPrefs);
  const setConfig = useStore((s) => s.setPresidingConfig);
  const resetConfig = useStore((s) => s.resetPresidingConfig);

  const isEs = lang === "es";

  const update = (patch: Partial<PresidingPrefs>) => setPrefs(patch);

  const handleReset = () => {
    if (window.confirm(isEs
      ? "¿Restablecer todas las secciones a los valores S-38 por defecto?"
      : "Reset all sections to S-38 defaults?")) {
      setConfig(getDefaultPresidingConfig());
      setPrefs(getDefaultPresidingPrefs());
    }
  };

  return (
    <div className="flex flex-col gap-0 max-w-lg mx-auto">
      <h2 className="text-lg font-bold px-1 mb-3">{isEs ? "Configuración del Programa" : "Program Settings"}</h2>

      {/* Meeting start time */}
      <div className="px-4 py-4 bg-surface rounded-xl border border-slate-200 dark:border-slate-700 mb-3">
        <p className="text-sm font-semibold">{isEs ? "Hora de inicio de la reunión" : "Meeting Start Time"}</p>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">
          {isEs ? "Para calcular cuándo inicia cada parte" : "Used to calculate when each part begins"}
        </p>
        <div className="flex items-center gap-2">
          <select value={prefs.meetingStartHour}
            onChange={e => update({ meetingStartHour: parseInt(e.target.value) })}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary">
            {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h.toString().padStart(2, "0")}</option>)}
          </select>
          <span className="text-lg font-bold">:</span>
          <select value={prefs.meetingStartMinute}
            onChange={e => update({ meetingStartMinute: parseInt(e.target.value) })}
            className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary">
            {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => <option key={m} value={m}>{m.toString().padStart(2, "0")}</option>)}
          </select>
        </div>
      </div>

      {/* Time format */}
      <div className="px-4 py-4 bg-surface rounded-xl border border-slate-200 dark:border-slate-700 mb-3">
        <p className="text-sm font-semibold">{isEs ? "Formato de hora" : "Time Format"}</p>
        <p className="text-xs text-slate-500 mt-0.5 mb-3">
          {isEs ? "Mostrar horas en formato 24h o 12h" : "Display times in 24-hour or 12-hour format"}
        </p>
        <div className="flex gap-2">
          <button onClick={() => update({ timeFormat: "24h" })}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
              prefs.timeFormat === "24h" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}>
            24h
          </button>
          <button onClick={() => update({ timeFormat: "12h" })}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors ${
              prefs.timeFormat === "12h" ? "bg-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
            }`}>
            12h
          </button>
        </div>
      </div>

      {/* Auto-advance */}
      <button onClick={() => update({ autoAdvance: !prefs.autoAdvance })}
        className="w-full flex items-center justify-between px-4 py-4 bg-surface rounded-xl border border-slate-200 dark:border-slate-700 mb-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left">
        <div>
          <p className="text-sm font-semibold">{isEs ? "Avance automático" : "Auto-advance"}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEs ? "Pasar a la siguiente parte automáticamente" : "Automatically move to next part when time ends"}
          </p>
        </div>
        <span className={`text-sm font-bold ${prefs.autoAdvance ? "text-primary" : "text-slate-400"}`}>
          {prefs.autoAdvance ? "ON" : "OFF"}
        </span>
      </button>

      {/* Reset */}
      <button onClick={handleReset}
        className="w-full flex items-center justify-between px-4 py-4 bg-surface rounded-xl border border-red-200 dark:border-red-900 mb-3 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors text-left">
        <div>
          <p className="text-sm font-semibold text-red-600 dark:text-red-400">
            {isEs ? "Restablecer programa" : "Reset Program"}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEs ? "Restaurar la estructura S-38 por defecto" : "Restore default S-38 meeting structure"}
          </p>
        </div>
      </button>
    </div>
  );
}