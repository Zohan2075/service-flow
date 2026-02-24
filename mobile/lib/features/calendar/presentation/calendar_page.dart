import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:table_calendar/table_calendar.dart';
import '../providers/calendar_providers.dart';
import '../models/calendar_models.dart';
import 'add_entry_sheet.dart';

class CalendarPage extends ConsumerWidget {
  const CalendarPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedMonth = ref.watch(selectedMonthProvider);
    final selectedDay = ref.watch(selectedDayProvider);
    final calendarAsync = ref.watch(calendarDataProvider);
    final serviceTypesAsync = ref.watch(serviceTypesProvider);

    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    // Build events map for TableCalendar
    final Map<DateTime, List<CalendarDay>> events = {};
    calendarAsync.whenData((days) {
      for (final day in days) {
        events[day.dateTime] = [day];
      }
    });

    CalendarDay? selectedDayData;
    if (calendarAsync.hasValue) {
      final key = DateFormat('yyyy-MM-dd').format(selectedDay);
      selectedDayData = calendarAsync.value!
          .cast<CalendarDay?>()
          .firstWhere((d) => d?.date == key, orElse: () => null);
    }

    final serviceTypeMap = <String, ServiceType>{};
    serviceTypesAsync.whenData((types) {
      for (final t in types) {
        serviceTypeMap[t.id] = t;
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: Text(DateFormat('MMMM yyyy').format(selectedMonth)),
        actions: [
          IconButton(
            icon: const Icon(Icons.today),
            onPressed: () {
              ref.read(selectedMonthProvider.notifier).state = DateTime.now();
              ref.read(selectedDayProvider.notifier).state = DateTime.now();
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      floatingActionButton: FloatingActionButton.large(
        onPressed: () => showModalBottomSheet(
          context: context,
          isScrollControlled: true,
          useRootNavigator: true,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          builder: (_) => AddEntrySheet(selectedDate: selectedDay),
        ),
        child: const Icon(Icons.add, size: 32),
      ),
      body: Column(
        children: [
          // Calendar widget
          Card(
            margin: const EdgeInsets.all(12),
            child: TableCalendar(
              firstDay: DateTime(2020),
              lastDay: DateTime(2030),
              focusedDay: selectedMonth,
              selectedDayPredicate: (day) => isSameDay(day, selectedDay),
              onDaySelected: (selected, focused) {
                ref.read(selectedDayProvider.notifier).state = selected;
                ref.read(selectedMonthProvider.notifier).state = focused;
              },
              onPageChanged: (focused) {
                ref.read(selectedMonthProvider.notifier).state = focused;
              },
              eventLoader: (day) {
                final key = DateTime(day.year, day.month, day.day);
                return events[key] ?? [];
              },
              calendarStyle: CalendarStyle(
                selectedDecoration: BoxDecoration(
                  color: cs.primary,
                  shape: BoxShape.circle,
                ),
                todayDecoration: BoxDecoration(
                  color: cs.primary.withOpacity(0.3),
                  shape: BoxShape.circle,
                ),
                markerDecoration: BoxDecoration(
                  color: cs.primary,
                  shape: BoxShape.circle,
                ),
              ),
              headerStyle: const HeaderStyle(
                formatButtonVisible: false,
                titleCentered: true,
              ),
            ),
          ),

          // Daily entries
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Daily Entries — ${DateFormat('MMM d').format(selectedDay)}',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                if (selectedDayData != null)
                  Text(
                    'Total: ${selectedDayData.totalDurationDisplay}',
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: cs.onSurface.withOpacity(0.6),
                    ),
                  ),
              ],
            ),
          ),

          Expanded(
            child: calendarAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (_) {
                if (selectedDayData == null || selectedDayData.entries.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.event_busy, size: 48, color: cs.onSurface.withOpacity(0.3)),
                        const SizedBox(height: 8),
                        Text('No entries', style: TextStyle(color: cs.onSurface.withOpacity(0.4))),
                      ],
                    ),
                  );
                }
                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(12, 4, 12, 100),
                  itemCount: selectedDayData.entries.length,
                  itemBuilder: (context, i) {
                    final entry = selectedDayData!.entries[i];
                    final st = serviceTypeMap[entry.serviceTypeId];
                    return _EntryCard(entry: entry, serviceType: st);
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _EntryCard extends StatelessWidget {
  final TimeEntry entry;
  final ServiceType? serviceType;

  const _EntryCard({required this.entry, this.serviceType});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final primary = serviceType?.flutterColor ?? const Color(0xFF2094F3);
    final timeStr = DateFormat('hh:mm a').format(entry.startTime);

    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        leading: Container(
          width: 48,
          height: 48,
          decoration: BoxDecoration(
            color: primary.withOpacity(0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(
            _iconFromName(serviceType?.icon ?? 'work'),
            color: primary,
          ),
        ),
        title: Text(entry.title, style: const TextStyle(fontWeight: FontWeight.w700)),
        subtitle: Text(
          '${entry.location != null ? "${entry.location} — " : ""}$timeStr',
          style: TextStyle(fontSize: 12, color: theme.colorScheme.onSurface.withOpacity(0.6)),
        ),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              entry.durationDisplay,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: primary,
              ),
            ),
            Text(
              'Logged',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: theme.colorScheme.onSurface.withOpacity(0.4),
              ),
            ),
          ],
        ),
      ),
    );
  }

  IconData _iconFromName(String name) {
    const map = {
      'build': Icons.build,
      'groups': Icons.groups,
      'analytics': Icons.analytics,
      'computer': Icons.computer,
      'phone_in_talk': Icons.phone_in_talk,
      'drive_eta': Icons.drive_eta,
      'home_repair_service': Icons.home_repair_service,
      'medical_services': Icons.medical_services,
      'work': Icons.work,
    };
    return map[name] ?? Icons.work;
  }
}
