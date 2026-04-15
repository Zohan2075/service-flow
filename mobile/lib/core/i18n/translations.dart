const Map<String, Map<String, String>> translations = {
  'en': {
    // Nav
    'nav.calendar': 'Calendar',
    'nav.reports': 'Reports',
    'nav.settings': 'Settings',

    // Login
    'login.welcome': 'Welcome back',
    'login.email': 'Email',
    'login.password': 'Password',
    'login.signIn': 'Sign In',
    'login.continueGoogle': 'Continue with Google',
    'login.or': 'or',
    'login.noAccount': "Don't have an account? ",
    'login.signUp': 'Sign Up',

    // Calendar
    'calendar.today': 'Today',
    'calendar.dailyEntries': 'Daily Entries',
    'calendar.total': 'Total',
    'calendar.week': 'Week',
    'calendar.noEntries': 'No entries for this day',
    'calendar.addHint': 'Tap + to add one',
    'calendar.logged': 'Logged',

    // Entry
    'entry.new': 'New Entry',
    'entry.edit': 'Edit Entry',
    'entry.title': 'Title',
    'entry.serviceType': 'Service Type',
    'entry.timeMode': 'Time Mode',
    'entry.manualDuration': 'Manual Duration',
    'entry.startEnd': 'Start / End',
    'entry.hours': 'Hours',
    'entry.minutes': 'Minutes',
    'entry.startTime': 'Start Time',
    'entry.endTime': 'End Time',
    'entry.location': 'Location',
    'entry.notes': 'Notes',
    'entry.save': 'Save',
    'entry.add': 'Add Entry',

    // Reports
    'reports.title': 'Reports',
    'reports.totalHours': 'Total Hours',
    'reports.daysWorked': 'Days Worked',
    'reports.totalEntries': 'Total Entries',
    'reports.avgDay': 'Avg / Day',
    'reports.byServiceType': 'By Service Type',
    'reports.noData': 'No data for this month',
    'reports.entries': 'entries',

    // Settings
    'settings.title': 'Settings',
    'settings.appearance': 'Appearance',
    'settings.theme': 'Theme',
    'settings.light': 'Light',
    'settings.dark': 'Dark',
    'settings.system': 'System',
    'settings.language': 'Language',
    'settings.langEnglish': 'English',
    'settings.langSpanish': 'Español',
    'settings.serviceTypes': 'Service Types',
    'settings.addServiceType': 'Add Service Type',
    'settings.stName': 'Name',
    'settings.color': 'Color',
    'settings.icon': 'Icon',
    'settings.create': 'Create',
    'settings.signOut': 'Sign Out',

    // Months
    'month.1': 'January',
    'month.2': 'February',
    'month.3': 'March',
    'month.4': 'April',
    'month.5': 'May',
    'month.6': 'June',
    'month.7': 'July',
    'month.8': 'August',
    'month.9': 'September',
    'month.10': 'October',
    'month.11': 'November',
    'month.12': 'December',
  },
  'es': {
    // Nav
    'nav.calendar': 'Calendario',
    'nav.reports': 'Reportes',
    'nav.settings': 'Ajustes',

    // Login
    'login.welcome': 'Bienvenido de nuevo',
    'login.email': 'Correo electrónico',
    'login.password': 'Contraseña',
    'login.signIn': 'Iniciar Sesión',
    'login.continueGoogle': 'Continuar con Google',
    'login.or': 'o',
    'login.noAccount': '¿No tienes cuenta? ',
    'login.signUp': 'Regístrate',

    // Calendar
    'calendar.today': 'Hoy',
    'calendar.dailyEntries': 'Entradas del Día',
    'calendar.total': 'Total',
    'calendar.week': 'Semana',
    'calendar.noEntries': 'No hay entradas para este día',
    'calendar.addHint': 'Toca + para agregar una',
    'calendar.logged': 'Registrado',

    // Entry
    'entry.new': 'Nueva Entrada',
    'entry.edit': 'Editar Entrada',
    'entry.title': 'Título',
    'entry.serviceType': 'Tipo de Servicio',
    'entry.timeMode': 'Modo de Tiempo',
    'entry.manualDuration': 'Duración Manual',
    'entry.startEnd': 'Inicio / Fin',
    'entry.hours': 'Horas',
    'entry.minutes': 'Minutos',
    'entry.startTime': 'Hora de Inicio',
    'entry.endTime': 'Hora de Fin',
    'entry.location': 'Ubicación',
    'entry.notes': 'Notas',
    'entry.save': 'Guardar',
    'entry.add': 'Agregar Entrada',

    // Reports
    'reports.title': 'Reportes',
    'reports.totalHours': 'Horas Totales',
    'reports.daysWorked': 'Días Trabajados',
    'reports.totalEntries': 'Total de Entradas',
    'reports.avgDay': 'Prom / Día',
    'reports.byServiceType': 'Por Tipo de Servicio',
    'reports.noData': 'Sin datos para este mes',
    'reports.entries': 'entradas',

    // Settings
    'settings.title': 'Ajustes',
    'settings.appearance': 'Apariencia',
    'settings.theme': 'Tema',
    'settings.light': 'Claro',
    'settings.dark': 'Oscuro',
    'settings.system': 'Sistema',
    'settings.language': 'Idioma',
    'settings.langEnglish': 'English',
    'settings.langSpanish': 'Español',
    'settings.serviceTypes': 'Tipos de Servicio',
    'settings.addServiceType': 'Agregar Tipo de Servicio',
    'settings.stName': 'Nombre',
    'settings.color': 'Color',
    'settings.icon': 'Ícono',
    'settings.create': 'Crear',
    'settings.signOut': 'Cerrar Sesión',

    // Months
    'month.1': 'Enero',
    'month.2': 'Febrero',
    'month.3': 'Marzo',
    'month.4': 'Abril',
    'month.5': 'Mayo',
    'month.6': 'Junio',
    'month.7': 'Julio',
    'month.8': 'Agosto',
    'month.9': 'Septiembre',
    'month.10': 'Octubre',
    'month.11': 'Noviembre',
    'month.12': 'Diciembre',
  },
};

String tr(String key, String language) {
  return translations[language]?[key] ?? translations['en']?[key] ?? key;
}

String monthName(int month, String language) {
  return tr('month.$month', language);
}
