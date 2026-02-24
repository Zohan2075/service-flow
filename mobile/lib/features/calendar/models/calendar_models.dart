class ServiceType {
  final String id;
  final String name;
  final String? description;
  final String color;
  final String icon;
  final int sortOrder;
  final bool isActive;

  const ServiceType({
    required this.id,
    required this.name,
    this.description,
    required this.color,
    required this.icon,
    required this.sortOrder,
    required this.isActive,
  });

  factory ServiceType.fromJson(Map<String, dynamic> json) => ServiceType(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
        color: json['color'] as String? ?? '#2094f3',
        icon: json['icon'] as String? ?? 'work',
        sortOrder: json['sort_order'] as int? ?? 0,
        isActive: json['is_active'] as bool? ?? true,
      );

  Color get flutterColor {
    final hex = color.replaceAll('#', '');
    return Color(int.parse('FF$hex', radix: 16));
  }
}

class TimeEntry {
  final String id;
  final String title;
  final String? notes;
  final String? location;
  final DateTime startTime;
  final DateTime? endTime;
  final int? durationSeconds;
  final String durationDisplay;
  final String serviceTypeId;

  const TimeEntry({
    required this.id,
    required this.title,
    this.notes,
    this.location,
    required this.startTime,
    this.endTime,
    this.durationSeconds,
    required this.durationDisplay,
    required this.serviceTypeId,
  });

  factory TimeEntry.fromJson(Map<String, dynamic> json) => TimeEntry(
        id: json['id'] as String,
        title: json['title'] as String,
        notes: json['notes'] as String?,
        location: json['location'] as String?,
        startTime: DateTime.parse(json['start_time'] as String),
        endTime: json['end_time'] != null
            ? DateTime.parse(json['end_time'] as String)
            : null,
        durationSeconds: json['duration_seconds'] as int?,
        durationDisplay: json['duration_display'] as String? ?? '—',
        serviceTypeId: json['service_type_id'] as String,
      );
}

class CalendarDay {
  final String date;
  final List<TimeEntry> entries;
  final int totalDurationSeconds;
  final String totalDurationDisplay;

  const CalendarDay({
    required this.date,
    required this.entries,
    required this.totalDurationSeconds,
    required this.totalDurationDisplay,
  });

  factory CalendarDay.fromJson(Map<String, dynamic> json) => CalendarDay(
        date: json['date'] as String,
        entries: (json['entries'] as List)
            .map((e) => TimeEntry.fromJson(e as Map<String, dynamic>))
            .toList(),
        totalDurationSeconds: json['total_duration_seconds'] as int? ?? 0,
        totalDurationDisplay: json['total_duration_display'] as String? ?? '0m',
      );

  DateTime get dateTime => DateTime.parse(date);
}
