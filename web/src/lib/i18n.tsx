"use client";

import { createContext, useContext } from "react";
import { useStore } from "@/lib/store";
import type { Language } from "@/types/data";

// ─── Translation dictionaries ────────────────────────────────────────────────

const translations = {
  en: {
    // Nav
    "nav.calendar": "Calendar",
    "nav.reports": "Reports",
    "nav.settings": "Settings",

    // Login
    "login.welcome": "Welcome back",
    "login.googleHint": "Google sign-in needs a Google OAuth client id in web/.env.local before it can open the Google account window.",
    "login.continueGoogle": "Continue with Google",
    "login.loadingGoogle": "Loading Google sign-in...",
    "login.footnote": "Sign in with your Google account to save your profile locally and connect Google Drive backup.",

    // Calendar header
    "calendar.today": "Today",
    "calendar.wk": "Wk",

    // Daily Entries
    "calendar.dailyEntries": "Daily Entries",
    "calendar.total": "Total",
    "calendar.week": "Week",
    "calendar.noEntries": "No entries for this day",
    "calendar.addHint": "Click the + button to add one",
    "calendar.entryDeleted": "Entry deleted",
    "calendar.logged": "Logged",

    // Entry modal
    "entry.new": "New Entry",
    "entry.edit": "Edit Entry",
    "entry.title": "Title",
    "entry.titlePlaceholder": "e.g. System Maintenance",
    "entry.serviceType": "Service Type",
    "entry.timeMode": "Time Mode",
    "entry.manualDuration": "Manual Duration",
    "entry.startEnd": "Start / End",
    "entry.hours": "Hours",
    "entry.minutes": "Minutes",
    "entry.startTime": "Start Time",
    "entry.endTime": "End Time",
    "entry.location": "Location",
    "entry.locationPlaceholder": "e.g. Server Room A",
    "entry.notes": "Notes",
    "entry.notesPlaceholder": "Optional notes...",
    "entry.saving": "Saving...",
    "entry.update": "Update Entry",
    "entry.add": "Add Entry",
    "entry.added": "Entry added!",
    "entry.updated": "Entry updated!",
    "entry.addFailed": "Failed to add entry",
    "entry.updateFailed": "Failed to update entry",
    "entry.editShort": "Edit",
    "entry.delete": "Delete",
    "entry.confirmDelete": "Confirm",
    "entry.zeroDuration": "Duration must be greater than 0",

    // More text
    "calendar.more": "more",

    // Reports
    "reports.title": "Reports",
    "reports.totalHours": "Total Hours",
    "reports.daysWorked": "Days Worked",
    "reports.totalEntries": "Total Entries",
    "reports.avgDay": "Avg / Day",
    "reports.byServiceType": "By Service Type",
    "reports.noData": "No data for this month",
    "reports.entries": "entries",

    // Settings
    "settings.title": "Settings",
    "settings.profile": "Profile",
    "settings.editProfile": "Edit profile",
    "settings.displayName": "Display Name",
    "settings.bioNotes": "Bio / Notes",
    "settings.bioPlaceholder": "A short note about yourself...",
    "settings.save": "Save",
    "settings.cancel": "Cancel",
    "settings.profileUpdated": "Profile updated",

    "settings.appearance": "Appearance",
    "settings.theme": "Theme",
    "settings.light": "☀️ Light",
    "settings.dark": "🌙 Dark",
    "settings.system": "💻 System",
    "settings.accentColor": "Accent Color",
    "settings.customSurface": "Custom Surface",
    "settings.customBackground": "Custom Background",
    "settings.resetDefault": "Reset to default",

    "settings.language": "Language",
    "settings.langEnglish": "English",
    "settings.langSpanish": "Español",

    "settings.entryDefaults": "Entry Defaults",
    "settings.defaultMode": "Default Mode",
    "settings.defaultHours": "Default Hours",
    "settings.defaultMinutes": "Default Minutes",
    "settings.weekLayout": "Week Layout",
    "settings.sunSat": "Sunday to Saturday",
    "settings.monSun": "Monday to Sunday",
    "settings.weekNote": "Week numbers in the calendar follow this layout.",

    "settings.serviceTypes": "Service Types",
    "settings.dragHint": "Drag the handle to reorder your service types.",
    "settings.addNew": "Add New",
    "settings.stName": "Service type name",
    "settings.color": "Color",
    "settings.icon": "Icon",
    "settings.createST": "Create Service Type",
    "settings.stCreated": "Service type created!",

    "settings.dataManagement": "Data Management",
    "settings.exportJson": "Export",
    "settings.exportDesc": "Download a backup file to your device",
    "settings.importJson": "Import",
    "settings.importDesc": "Restore data from a backup file",
    "settings.exported": "Exported successfully!",
    "settings.imported": "Data imported successfully!",
    "settings.invalidBackup": "Invalid backup file",

    "settings.driveSync": "Google Drive Sync",
    "settings.driveConfigHint": "Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to web/.env.local and restart the app to enable Google sign-in and Drive sync.",
    "settings.notSignedIn": "Google account not signed in",
    "settings.driveConnected": "Google Drive connected",
    "settings.driveNotConnected": "Google Drive not connected yet",
    "settings.signInFirst": "Sign in first, then connect Drive sync.",
    "settings.driveReady": "Drive sync is ready for auto-sync, backup, and restore.",
    "settings.connectDriveOnce": "Connect Drive once to enable sync, backup, and restore.",
    "settings.signInGoogle": "Sign in with Google",
    "settings.connectDrive": "Connect Drive",
    "settings.reconnectDrive": "Reconnect Drive",
    "settings.autoSync": "Auto-sync",
    "settings.autoSyncDesc": "Sync changes to Drive while the app is open",
    "settings.autoSyncStatus": "Changes sync automatically while the app is open.",
    "settings.autoSyncEnabled": "Auto-sync enabled",
    "settings.autoSyncDisabled": "Auto-sync disabled",
    "settings.driveRequired": "Drive access required for auto-sync",
    "settings.synced": "Synced",
    "settings.syncing": "Syncing to Drive",
    "settings.syncError": "Sync error",
    "settings.syncNow": "Sync now",
    "settings.offlineShort": "Offline",
    "settings.offlineSyncDesc": "Reconnect to resume Drive sync.",
    "settings.last": "Last",
    "settings.manual": "Manual Backup & Restore",
    "settings.manualSyncDesc": "Use the backup and restore buttons below for one-time sync actions.",
    "settings.backupDrive": "Backup to Drive",
    "settings.backupDriveDesc": "Upload the current app data to your Drive backup",
    "settings.restoreDrive": "Restore from Drive",
    "settings.restoreDriveDesc": "Download the latest Drive backup into this device",
    "settings.backedUp": "Backed up to Google Drive!",
    "settings.restored": "Restored from Google Drive!",
    "settings.driveBackupFailed": "Drive backup failed",
    "settings.driveRestoreFailed": "Drive restore failed",
    "settings.driveConnectedToast": "Google Drive connected",
    "settings.driveConnectionFailed": "Drive connection failed",
    "settings.signedInGoogle": "Signed in with Google",
    "settings.signInFailed": "Google sign-in failed",
    "settings.useButtonAbove": "Use the button above to sign in, then connect Google Drive sync.",

    "settings.dangerZone": "Danger Zone",
    "settings.resetAll": "Reset All Data",
    "settings.resetAllDesc": "Permanently delete all service types, entries, and settings",
    "settings.resetConfirm": "Are you sure? This will permanently delete all your data. Consider exporting a backup first.",
    "settings.deleteEverything": "Delete Everything",
    "settings.allCleared": "All data cleared",

    // Weekday abbreviations
    "day.sun": "Sun",
    "day.mon": "Mon",
    "day.tue": "Tue",
    "day.wed": "Wed",
    "day.thu": "Thu",
    "day.fri": "Fri",
    "day.sat": "Sat",

    // Sidebar
    "sidebar.signOut": "Sign out",

    // Offline
    "offline.banner": "You're offline — changes are saved locally",
    "offline.syncPending": "Changes will sync when you're back online",
  },
  es: {
    // Nav
    "nav.calendar": "Calendario",
    "nav.reports": "Reportes",
    "nav.settings": "Ajustes",

    // Login
    "login.welcome": "Bienvenido de nuevo",
    "login.googleHint": "El inicio de sesión con Google necesita un ID de cliente OAuth en web/.env.local para abrir la ventana de cuenta de Google.",
    "login.continueGoogle": "Continuar con Google",
    "login.loadingGoogle": "Cargando inicio de sesión...",
    "login.footnote": "Inicia sesión con tu cuenta de Google para guardar tu perfil localmente y conectar la copia de seguridad de Google Drive.",

    // Calendar header
    "calendar.today": "Hoy",
    "calendar.wk": "Sem",

    // Daily Entries
    "calendar.dailyEntries": "Entradas del Día",
    "calendar.total": "Total",
    "calendar.week": "Semana",
    "calendar.noEntries": "No hay entradas para este día",
    "calendar.addHint": "Presiona el botón + para agregar una",
    "calendar.entryDeleted": "Entrada eliminada",
    "calendar.logged": "Registrado",

    // Entry modal
    "entry.new": "Nueva Entrada",
    "entry.edit": "Editar Entrada",
    "entry.title": "Título",
    "entry.titlePlaceholder": "ej. Mantenimiento del Sistema",
    "entry.serviceType": "Tipo de Servicio",
    "entry.timeMode": "Modo de Tiempo",
    "entry.manualDuration": "Duración Manual",
    "entry.startEnd": "Inicio / Fin",
    "entry.hours": "Horas",
    "entry.minutes": "Minutos",
    "entry.startTime": "Hora de Inicio",
    "entry.endTime": "Hora de Fin",
    "entry.location": "Ubicación",
    "entry.locationPlaceholder": "ej. Sala de Servidores A",
    "entry.notes": "Notas",
    "entry.notesPlaceholder": "Notas opcionales...",
    "entry.saving": "Guardando...",
    "entry.update": "Actualizar Entrada",
    "entry.add": "Agregar Entrada",
    "entry.added": "¡Entrada agregada!",
    "entry.updated": "¡Entrada actualizada!",
    "entry.addFailed": "Error al agregar entrada",
    "entry.updateFailed": "Error al actualizar entrada",
    "entry.editShort": "Editar",
    "entry.delete": "Eliminar",
    "entry.confirmDelete": "Confirmar",
    "entry.zeroDuration": "La duración debe ser mayor a 0",

    // More text
    "calendar.more": "más",

    // Reports
    "reports.title": "Reportes",
    "reports.totalHours": "Horas Totales",
    "reports.daysWorked": "Días Trabajados",
    "reports.totalEntries": "Total de Entradas",
    "reports.avgDay": "Prom / Día",
    "reports.byServiceType": "Por Tipo de Servicio",
    "reports.noData": "Sin datos para este mes",
    "reports.entries": "entradas",

    // Settings
    "settings.title": "Ajustes",
    "settings.profile": "Perfil",
    "settings.editProfile": "Editar perfil",
    "settings.displayName": "Nombre para Mostrar",
    "settings.bioNotes": "Bio / Notas",
    "settings.bioPlaceholder": "Una breve nota sobre ti...",
    "settings.save": "Guardar",
    "settings.cancel": "Cancelar",
    "settings.profileUpdated": "Perfil actualizado",

    "settings.appearance": "Apariencia",
    "settings.theme": "Tema",
    "settings.light": "☀️ Claro",
    "settings.dark": "🌙 Oscuro",
    "settings.system": "💻 Sistema",
    "settings.accentColor": "Color de Acento",
    "settings.customSurface": "Superficie Personalizada",
    "settings.customBackground": "Fondo Personalizado",
    "settings.resetDefault": "Restablecer por defecto",

    "settings.language": "Idioma",
    "settings.langEnglish": "English",
    "settings.langSpanish": "Español",

    "settings.entryDefaults": "Valores Predeterminados",
    "settings.defaultMode": "Modo Predeterminado",
    "settings.defaultHours": "Horas Predeterminadas",
    "settings.defaultMinutes": "Minutos Predeterminados",
    "settings.weekLayout": "Disposición de Semana",
    "settings.sunSat": "Domingo a Sábado",
    "settings.monSun": "Lunes a Domingo",
    "settings.weekNote": "Los números de semana en el calendario siguen esta disposición.",

    "settings.serviceTypes": "Tipos de Servicio",
    "settings.dragHint": "Arrastra el ícono para reordenar tus tipos de servicio.",
    "settings.addNew": "Agregar Nuevo",
    "settings.stName": "Nombre del tipo de servicio",
    "settings.color": "Color",
    "settings.icon": "Ícono",
    "settings.createST": "Crear Tipo de Servicio",
    "settings.stCreated": "¡Tipo de servicio creado!",

    "settings.dataManagement": "Gestión de Datos",
    "settings.exportJson": "Exportar a JSON",
    "settings.exportDesc": "Descargar un archivo de copia de seguridad",
    "settings.importJson": "Importar desde JSON",
    "settings.importDesc": "Restaurar datos desde una copia de seguridad",
    "settings.exported": "¡Exportado exitosamente!",
    "settings.imported": "¡Datos importados exitosamente!",
    "settings.invalidBackup": "Archivo de respaldo inválido",

    "settings.driveSync": "Sincronización Google Drive",
    "settings.driveConfigHint": "Agrega NEXT_PUBLIC_GOOGLE_CLIENT_ID en web/.env.local y reinicia la app para habilitar Google y Drive.",
    "settings.notSignedIn": "Cuenta de Google no conectada",
    "settings.driveConnected": "Google Drive conectado",
    "settings.driveNotConnected": "Google Drive no conectado aún",
    "settings.signInFirst": "Inicia sesión primero, luego conecta Drive.",
    "settings.driveReady": "Drive está listo para sincronización, respaldo y restauración.",
    "settings.connectDriveOnce": "Conecta Drive una vez para habilitar sincronización, respaldo y restauración.",
    "settings.signInGoogle": "Iniciar sesión con Google",
    "settings.connectDrive": "Conectar Drive",
    "settings.reconnectDrive": "Reconectar Drive",
    "settings.autoSync": "Sincronización automática",
    "settings.autoSyncDesc": "Sincronizar cambios a Drive mientras la app está abierta",
    "settings.autoSyncStatus": "Los cambios se sincronizan automáticamente mientras la app está abierta.",
    "settings.autoSyncEnabled": "Sincronización automática activada",
    "settings.autoSyncDisabled": "Sincronización automática desactivada",
    "settings.driveRequired": "Se requiere acceso a Drive para la sincronización automática",
    "settings.synced": "Sincronizado",
    "settings.syncing": "Sincronizando con Drive",
    "settings.syncError": "Error de sincronización",
    "settings.syncNow": "Sincronizar ahora",
    "settings.offlineShort": "Sin conexión",
    "settings.offlineSyncDesc": "Reconéctate para reanudar la sincronización con Drive.",
    "settings.last": "Última",
    "settings.manual": "Respaldo y restauración manual",
    "settings.manualSyncDesc": "Usa los botones de abajo para acciones puntuales de sincronización.",
    "settings.backupDrive": "Respaldar en Drive",
    "settings.backupDriveDesc": "Subir los datos actuales de la app a tu respaldo en Drive",
    "settings.restoreDrive": "Restaurar de Drive",
    "settings.restoreDriveDesc": "Descargar el respaldo más reciente de Drive en este dispositivo",
    "settings.backedUp": "¡Respaldado en Google Drive!",
    "settings.restored": "¡Restaurado desde Google Drive!",
    "settings.driveBackupFailed": "Error en respaldo de Drive",
    "settings.driveRestoreFailed": "Error en restauración de Drive",
    "settings.driveConnectedToast": "Google Drive conectado",
    "settings.driveConnectionFailed": "Error al conectar Drive",
    "settings.signedInGoogle": "Sesión iniciada con Google",
    "settings.signInFailed": "Error en inicio de sesión con Google",
    "settings.useButtonAbove": "Usa el botón de arriba para iniciar sesión, luego conecta Google Drive.",

    "settings.dangerZone": "Zona de Peligro",
    "settings.resetAll": "Restablecer Todos los Datos",
    "settings.resetAllDesc": "Eliminar permanentemente todos los tipos de servicio, entradas y ajustes",
    "settings.resetConfirm": "¿Estás seguro? Esto eliminará permanentemente todos tus datos. Considera exportar una copia de seguridad primero.",
    "settings.deleteEverything": "Eliminar Todo",
    "settings.allCleared": "Todos los datos eliminados",

    // Weekday abbreviations
    "day.sun": "Dom",
    "day.mon": "Lun",
    "day.tue": "Mar",
    "day.wed": "Mié",
    "day.thu": "Jue",
    "day.fri": "Vie",
    "day.sat": "Sáb",

    // Sidebar
    "sidebar.signOut": "Cerrar sesión",

    // Offline
    "offline.banner": "Sin conexión — los cambios se guardan localmente",
    "offline.syncPending": "Los cambios se sincronizarán cuando vuelvas a estar en línea",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];

// ─── Context + Hook ──────────────────────────────────────────────────────────

const I18nContext = createContext<{
  t: (key: TranslationKey) => string;
  language: Language;
  setLanguage: (lang: Language) => void;
} | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useStore((s) => s.settings.language ?? "en");
  const updateSettings = useStore((s) => s.updateSettings);

  const setLanguage = (lang: Language) => updateSettings({ language: lang });

  const t = (key: TranslationKey): string => {
    const dict = translations[language] ?? translations.en;
    return (dict as Record<string, string>)[key] ?? (translations.en as Record<string, string>)[key] ?? key;
  };

  return (
    <I18nContext.Provider value={{ t, language, setLanguage }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used inside I18nProvider");
  return ctx;
}

// ─── Locale-aware date formatting helpers ────────────────────────────────────

const MONTH_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTH_NAMES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const MONTH_SHORT_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_SHORT_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function monthYear(date: Date, lang: Language): string {
  const names = lang === "es" ? MONTH_NAMES_ES : MONTH_NAMES_EN;
  return `${names[date.getMonth()]} ${date.getFullYear()}`;
}

export function monthShortYear(date: Date, lang: Language): string {
  const names = lang === "es" ? MONTH_SHORT_ES : MONTH_SHORT_EN;
  return `${names[date.getMonth()]} ${date.getFullYear()}`;
}

export function shortDate(date: Date, lang: Language): string {
  const names = lang === "es" ? MONTH_SHORT_ES : MONTH_SHORT_EN;
  return `${names[date.getMonth()]} ${date.getDate()}`;
}

const WEEKDAY_KEYS: TranslationKey[] = [
  "day.sun", "day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat",
];

export function weekdayLabels(lang: Language, mondayFirst: boolean): string[] {
  const dict = translations[lang] ?? translations.en;
  const labels = WEEKDAY_KEYS.map((k) => (dict as Record<string, string>)[k]);
  return mondayFirst ? [...labels.slice(1), labels[0]] : labels;
}
