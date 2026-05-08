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
    "entry.entryType": "Entry Type",
    "entry.timeMode": "Time Mode",
    "entry.unitsMode": "Units Mode",
    "entry.timeSubMode": "Time Input",
    "entry.manualDuration": "Manual Duration",
    "entry.startEnd": "Start / End",
    "entry.hours": "Hours",
    "entry.minutes": "Minutes",
    "entry.quantity": "Quantity",
    "entry.zeroQuantity": "Quantity must be greater than 0",
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
    "entry.serviceTypeMismatch": "This entry keeps its original type because the selected service is now configured differently.",
    "entry.titleOptionalHint": "Leave it blank to use the selected service type name.",
    "entry.planMode": "Planned Work",
    "entry.planModeDesc": "Mark this entry as planned so it only counts toward Calendar planning totals.",

    // More text
    "calendar.more": "more",
    "calendar.units": "units",
    "calendar.counted": "Counted",
    "calendar.monthTotal": "Month Total",
    "calendar.monthPlanned": "Month Planned",
    "calendar.monthPlannedVsTotal": "Planned + Total",
    "calendar.planned": "Planned",
    "calendar.plannedShort": "Plan",

    // Reports
    "reports.title": "Reports",
    "reports.totalHours": "Total Hours",
    "reports.daysWorked": "Days Worked",
    "reports.totalEntries": "Total Entries",
    "reports.avgDay": "Avg / Day",
    "reports.byServiceType": "By Service Type",
    "reports.noData": "No data for this month",
    "reports.entries": "entries",
    "reports.totalUnits": "Total Units",
    "reports.yearlyTotals": "Yearly Totals",
    "reports.monthlyCombinedTotals": "Monthly Combined Totals",
    "reports.allServicesCombined": "All Services Combined",
    "reports.noCombinedGoals": "No combined goals for this period",
    "reports.servicesGroupedByEntryType": "Time and unit services are shown separately.",
    "reports.timeServices": "Time Services",
    "reports.timeServicesDesc": "Duration-based services keep their contribution bars.",
    "reports.unitServices": "Unit Services",
    "reports.unitServicesDesc": "Unit-based services are listed without bars.",
    "reports.annualCycleTotals": "Annual Cycle Totals",
    "reports.activeAnnualCycle": "Current reusable yearly cycle",
    "reports.annualServiceCycleDesc": "Each service uses its own yearly cycle start month.",
    "reports.goalProgress": "Goal Progress",
    "reports.targetsCleared": "targets cleared",
    "reports.wellDone": "Well done!",
    "reports.monthlyGoalAchieved": "Monthly goal achieved",

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
    "settings.profilePhotoHint": "Upload a photo to override the Google image. It will be stored locally and included in backups.",
    "settings.profilePhotoProcessing": "Preparing image...",
    "settings.profilePhotoFailed": "Could not process that image.",
    "settings.uploadPhoto": "Upload Photo",
    "settings.replacePhoto": "Replace Photo",
    "settings.resetPhoto": "Use Google Photo",
    "settings.customPhotoActive": "Using your uploaded photo",
    "settings.googlePhotoActive": "Using your Google profile photo",

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
    "settings.languageDesc": "Choose the language used across the web app.",
    "settings.langEnglish": "English",
    "settings.langSpanish": "Español",
    "settings.entriesServices": "Entries & Services",
    "settings.reportsGoals": "Reports & Goals",
    "settings.dataBackup": "Data & Backup",
    "settings.organizedSettingsTitle": "Settings by category",
    "settings.organizedSettingsDesc": "Move through the sections below. Backup stays expanded so restore actions remain one tap away.",
    "settings.supportBadge": "Support",
    "settings.supportTitle": "Help keep ServiceFlow moving",
    "settings.supportDesc": "If the app saves you time, you can support ongoing improvements, polish, and maintenance with a small Ko-fi donation.",
    "settings.supportButton": "Support on Ko-fi",

    "settings.entryDefaults": "Entry Defaults",
    "settings.planMode": "Enable Plan Mode",
    "settings.planModeDesc": "Show a planned toggle in the entry form. Planned work appears in Calendar only and does not count toward reports or goals.",
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
    "settings.serviceEntryType": "Service Entry Type",
    "settings.entryTypeTime": "Time",
    "settings.entryTypeUnits": "Units",
    "settings.createST": "Create Service Type",
    "settings.stCreated": "Service type created!",
    "settings.stUpdated": "Service type updated!",
    "settings.editST": "Edit",

    "settings.reportsDisplay": "Reports",
    "settings.showYearTotals": "Show Yearly Totals",
    "settings.showYearTotalsDesc": "Display yearly totals per service type in reports",
    "settings.goals": "Goals",
    "settings.goalsHint": "Set monthly and yearly targets for hours, units, or both.",
    "settings.goalsTotalsNote": "Goal progress appears in reports when Show Yearly Totals is enabled.",
    "settings.serviceGoals": "Per-Service Goals",
    "settings.combinedGoals": "Combined Goals",
    "settings.monthlyGoal": "Monthly",
    "settings.yearlyGoal": "Yearly",
    "settings.goalHours": "Hours",
    "settings.goalUnits": "Units",
    "settings.goalName": "Goal Name",
    "settings.goalNamePlaceholder": "e.g. Support + Visits",
    "settings.goalServices": "Services",
    "settings.goalCycleStart": "Year starts in",
    "settings.goalDefaultName": "Goal",
    "settings.goalCreated": "Goal created!",
    "settings.goalSaved": "Goal saved!",
    "settings.goalCleared": "Goal cleared",
    "settings.goalDeleted": "Goal deleted!",
    "settings.goalServicesRequired": "Select at least one service",
    "settings.goalTargetRequired": "Add at least one hours or units target",
    "settings.addCombinedGoal": "Add Combined Goal",
    "settings.clearGoal": "Clear Goal",
    "settings.deleteGoal": "Delete Goal",
    "settings.noCombinedGoals": "No combined goals yet",

    "settings.dataManagement": "Data Management",
    "settings.exportJson": "Export",
    "settings.exportDesc": "Download a backup file to your device",
    "settings.importJson": "Import",
    "settings.importDesc": "Restore data from a backup file",
    "settings.exported": "Exported successfully!",
    "settings.imported": "Data imported successfully!",
    "settings.invalidBackup": "Invalid backup file",

    "settings.driveSync": "Google Drive Backup",
    "settings.driveConfigHint": "Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to web/.env.local and restart the app to enable Google sign-in and Drive backup.",
    "settings.notSignedIn": "Google account not signed in",
    "settings.driveConnected": "Google Drive connected",
    "settings.driveNotConnected": "Google Drive access not granted yet",
    "settings.signInFirst": "Backup or restore will ask you to sign in when needed.",
    "settings.driveReady": "Up to date",
    "settings.connectDriveOnce": "Backup or restore will request Drive access when needed.",
    "settings.signInGoogle": "Sign in with Google",
    "settings.pendingBackup": "Local changes not yet backed up",
    "settings.noPendingChanges": "All changes backed up",
    "settings.synced": "Synced",
    "settings.syncing": "Backing up to Drive",
    "settings.syncError": "Backup error",
    "settings.offlineShort": "Offline",
    "settings.last": "Last",
    "settings.manual": "Backup & Restore",
    "settings.backupDrive": "Backup to Google Drive",
    "settings.backupDriveDesc": "Upload the current app data to your Drive backup",
    "settings.restoreDrive": "Restore from Google Drive",
    "settings.restoreDriveDesc": "Download the latest Drive backup into this device",
    "settings.backedUp": "Backed up to Google Drive!",
    "settings.restored": "Restored from Google Drive!",
    "settings.driveBackupFailed": "Drive backup failed",
    "settings.driveRestoreFailed": "Drive restore failed",

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
    "entry.entryType": "Tipo de Entrada",
    "entry.timeMode": "Modo Tiempo",
    "entry.unitsMode": "Modo Unidades",
    "entry.timeSubMode": "Entrada de Tiempo",
    "entry.manualDuration": "Duración Manual",
    "entry.startEnd": "Inicio / Fin",
    "entry.hours": "Horas",
    "entry.minutes": "Minutos",
    "entry.quantity": "Cantidad",
    "entry.zeroQuantity": "La cantidad debe ser mayor a 0",
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
    "entry.serviceTypeMismatch": "Esta entrada conserva su tipo original porque el servicio seleccionado ahora esta configurado de otra forma.",
    "entry.titleOptionalHint": "Dejalo en blanco para usar el nombre del tipo de servicio seleccionado.",
    "entry.planMode": "Trabajo planeado",
    "entry.planModeDesc": "Marca esta entrada como planeada para que solo cuente en los totales de planificacion del Calendario.",

    // More text
    "calendar.more": "más",
    "calendar.units": "unidades",
    "calendar.counted": "Contado",
    "calendar.monthTotal": "Total del mes",
    "calendar.monthPlanned": "Planeado del mes",
    "calendar.monthPlannedVsTotal": "Planeado + Total",
    "calendar.planned": "Planeado",
    "calendar.plannedShort": "Plan",

    // Reports
    "reports.title": "Reportes",
    "reports.totalHours": "Horas Totales",
    "reports.daysWorked": "Días Trabajados",
    "reports.totalEntries": "Total de Entradas",
    "reports.avgDay": "Prom / Día",
    "reports.byServiceType": "Por Tipo de Servicio",
    "reports.noData": "Sin datos para este mes",
    "reports.entries": "entradas",
    "reports.totalUnits": "Total Unidades",
    "reports.yearlyTotals": "Totales del Año",
    "reports.monthlyCombinedTotals": "Totales Combinados del Mes",
    "reports.allServicesCombined": "Todos los Servicios Combinados",
    "reports.noCombinedGoals": "No hay metas combinadas para este período",
    "reports.servicesGroupedByEntryType": "Los servicios de tiempo y de unidades se muestran por separado.",
    "reports.timeServices": "Servicios por Tiempo",
    "reports.timeServicesDesc": "Los servicios basados en duracion mantienen sus barras de contribucion.",
    "reports.unitServices": "Servicios por Unidades",
    "reports.unitServicesDesc": "Los servicios por unidades se muestran sin barras.",
    "reports.annualCycleTotals": "Totales del Ciclo Anual",
    "reports.activeAnnualCycle": "Ciclo anual reutilizable actual",
    "reports.annualServiceCycleDesc": "Cada servicio usa su propio mes de inicio anual.",
    "reports.goalProgress": "Progreso de la Meta",
    "reports.targetsCleared": "objetivos cumplidos",
    "reports.wellDone": "Bien hecho!",
    "reports.monthlyGoalAchieved": "Meta mensual cumplida",

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
    "settings.profilePhotoHint": "Sube una foto para reemplazar la imagen de Google. Se guardara localmente y se incluira en los respaldos.",
    "settings.profilePhotoProcessing": "Preparando imagen...",
    "settings.profilePhotoFailed": "No se pudo procesar esa imagen.",
    "settings.uploadPhoto": "Subir foto",
    "settings.replacePhoto": "Cambiar foto",
    "settings.resetPhoto": "Usar foto de Google",
    "settings.customPhotoActive": "Usando tu foto subida",
    "settings.googlePhotoActive": "Usando tu foto de perfil de Google",

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
    "settings.languageDesc": "Elige el idioma que se usa en toda la app web.",
    "settings.langEnglish": "English",
    "settings.langSpanish": "Español",
    "settings.entriesServices": "Entradas y Servicios",
    "settings.reportsGoals": "Reportes y Metas",
    "settings.dataBackup": "Datos y Respaldo",
    "settings.organizedSettingsTitle": "Ajustes por categoria",
    "settings.organizedSettingsDesc": "Muevete por las secciones de abajo. El respaldo se mantiene expandido para que restaurar siga estando a un toque.",
    "settings.supportBadge": "Apoya",
    "settings.supportTitle": "Ayuda a mantener ServiceFlow en marcha",
    "settings.supportDesc": "Si la app te ahorra tiempo, puedes apoyar las mejoras, el pulido y el mantenimiento con una pequena donacion en Ko-fi.",
    "settings.supportButton": "Apoyar en Ko-fi",

    "settings.entryDefaults": "Valores Predeterminados",
    "settings.planMode": "Activar modo plan",
    "settings.planModeDesc": "Muestra un interruptor de plan en el formulario de entradas. El trabajo planeado aparece solo en Calendario y no cuenta para reportes ni metas.",
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
    "settings.serviceEntryType": "Tipo de entrada del servicio",
    "settings.entryTypeTime": "Tiempo",
    "settings.entryTypeUnits": "Unidades",
    "settings.createST": "Crear Tipo de Servicio",
    "settings.stCreated": "¡Tipo de servicio creado!",
    "settings.stUpdated": "¡Tipo de servicio actualizado!",
    "settings.editST": "Editar",

    "settings.reportsDisplay": "Reportes",
    "settings.showYearTotals": "Mostrar Totales del Año",
    "settings.showYearTotalsDesc": "Mostrar totales anuales por tipo de servicio en reportes",
    "settings.goals": "Metas",
    "settings.goalsHint": "Define objetivos mensuales y anuales de horas, unidades, o ambos.",
    "settings.goalsTotalsNote": "El progreso de metas aparece en reportes cuando Mostrar Totales del Año está activado.",
    "settings.serviceGoals": "Metas por Servicio",
    "settings.combinedGoals": "Metas Combinadas",
    "settings.monthlyGoal": "Mensual",
    "settings.yearlyGoal": "Anual",
    "settings.goalHours": "Horas",
    "settings.goalUnits": "Unidades",
    "settings.goalName": "Nombre de la Meta",
    "settings.goalNamePlaceholder": "ej. Soporte + Visitas",
    "settings.goalServices": "Servicios",
    "settings.goalCycleStart": "El año empieza en",
    "settings.goalDefaultName": "Meta",
    "settings.goalCreated": "¡Meta creada!",
    "settings.goalSaved": "¡Meta guardada!",
    "settings.goalCleared": "Meta limpiada",
    "settings.goalDeleted": "¡Meta eliminada!",
    "settings.goalServicesRequired": "Selecciona al menos un servicio",
    "settings.goalTargetRequired": "Agrega al menos una meta de horas o unidades",
    "settings.addCombinedGoal": "Agregar Meta Combinada",
    "settings.clearGoal": "Limpiar Meta",
    "settings.deleteGoal": "Eliminar Meta",
    "settings.noCombinedGoals": "Aún no hay metas combinadas",

    "settings.dataManagement": "Gestión de Datos",
    "settings.exportJson": "Exportar a JSON",
    "settings.exportDesc": "Descargar un archivo de copia de seguridad",
    "settings.importJson": "Importar desde JSON",
    "settings.importDesc": "Restaurar datos desde una copia de seguridad",
    "settings.exported": "¡Exportado exitosamente!",
    "settings.imported": "¡Datos importados exitosamente!",
    "settings.invalidBackup": "Archivo de respaldo inválido",

    "settings.driveSync": "Respaldo en Google Drive",
    "settings.driveConfigHint": "Agrega NEXT_PUBLIC_GOOGLE_CLIENT_ID en web/.env.local y reinicia la app para habilitar Google y Drive.",
    "settings.notSignedIn": "Cuenta de Google no conectada",
    "settings.driveConnected": "Google Drive conectado",
    "settings.driveNotConnected": "El acceso a Google Drive aún no fue concedido",
    "settings.signInFirst": "Respaldar o restaurar te pedirá iniciar sesión cuando sea necesario.",
    "settings.driveReady": "El respaldo y la restauración están listos para usarse.",
    "settings.connectDriveOnce": "Respaldar o restaurar solicitará acceso a Drive cuando sea necesario.",
    "settings.signInGoogle": "Iniciar sesión con Google",
    "settings.pendingBackup": "Cambios locales sin respaldar",
    "settings.noPendingChanges": "Todo respaldado",
    "settings.synced": "Sincronizado",
    "settings.syncing": "Respaldando en Drive",
    "settings.syncError": "Error de respaldo",
    "settings.offlineShort": "Sin conexión",
    "settings.last": "Última",
    "settings.manual": "Respaldo y Restauración",
    "settings.backupDrive": "Respaldar en Drive",
    "settings.backupDriveDesc": "Subir los datos actuales de la app a tu respaldo en Drive",
    "settings.restoreDrive": "Restaurar de Drive",
    "settings.restoreDriveDesc": "Descargar el respaldo más reciente de Drive en este dispositivo",
    "settings.backedUp": "¡Respaldado en Google Drive!",
    "settings.restored": "¡Restaurado desde Google Drive!",
    "settings.driveBackupFailed": "Error en respaldo de Drive",
    "settings.driveRestoreFailed": "Error en restauración de Drive",

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

function localeTag(lang: Language): string {
  return lang === "es" ? "es-ES" : "en-US";
}

export function longDate(date: Date, lang: Language): string {
  return new Intl.DateTimeFormat(localeTag(lang), {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function dateTimeString(date: Date, lang: Language): string {
  return new Intl.DateTimeFormat(localeTag(lang), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const WEEKDAY_KEYS: TranslationKey[] = [
  "day.sun", "day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat",
];

export function weekdayLabels(lang: Language, mondayFirst: boolean): string[] {
  const dict = translations[lang] ?? translations.en;
  const labels = WEEKDAY_KEYS.map((k) => (dict as Record<string, string>)[k]);
  return mondayFirst ? [...labels.slice(1), labels[0]] : labels;
}
