import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../features/calendar/providers/calendar_providers.dart';

class ReportsPage extends ConsumerWidget {
  const ReportsPage({super.key});

  String _fmt(int seconds) {
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    return h > 0 ? '${h}h ${m.toString().padLeft(2, '0')}m' : '${m}m';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedMonth = ref.watch(selectedMonthProvider);
    final calendarAsync = ref.watch(calendarDataProvider);
    final serviceTypesAsync = ref.watch(serviceTypesProvider);
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports'),
        actions: [
          IconButton(
            icon: const Icon(Icons.chevron_left),
            onPressed: () {
              final prev = DateTime(selectedMonth.year, selectedMonth.month - 1);
              ref.read(selectedMonthProvider.notifier).state = prev;
            },
          ),
          TextButton(
            onPressed: () {},
            child: Text(DateFormat('MMM yyyy').format(selectedMonth),
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          IconButton(
            icon: const Icon(Icons.chevron_right),
            onPressed: () {
              final next = DateTime(selectedMonth.year, selectedMonth.month + 1);
              ref.read(selectedMonthProvider.notifier).state = next;
            },
          ),
        ],
      ),
      body: calendarAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (days) {
          final totalSeconds = days.fold(0, (s, d) => s + d.totalDurationSeconds);
          final totalEntries = days.fold(0, (s, d) => s + d.entries.length);
          final avgSeconds = days.isEmpty ? 0 : totalSeconds ~/ days.length;

          // By service type
          final byType = <String, _TypeStat>{};
          serviceTypesAsync.whenData((types) {
            for (final t in types) {
              byType[t.id] = _TypeStat(name: t.name, color: t.flutterColor, icon: t.icon);
            }
          });
          for (final day in days) {
            for (final e in day.entries) {
              byType.putIfAbsent(
                e.serviceTypeId,
                () => _TypeStat(name: 'Unknown', color: cs.primary, icon: 'work'),
              );
              byType[e.serviceTypeId]!.seconds += e.durationSeconds ?? 0;
              byType[e.serviceTypeId]!.count += 1;
            }
          }
          final sorted = byType.values.toList()
            ..sort((a, b) => b.seconds.compareTo(a.seconds));

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Summary cards
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.7,
                children: [
                  _StatCard(icon: Icons.schedule, label: 'Total Hours', value: _fmt(totalSeconds)),
                  _StatCard(icon: Icons.calendar_today, label: 'Days Worked', value: '${days.length}'),
                  _StatCard(icon: Icons.list_alt, label: 'Entries', value: '$totalEntries'),
                  _StatCard(icon: Icons.trending_up, label: 'Avg / Day', value: days.isEmpty ? '—' : _fmt(avgSeconds)),
                ],
              ),
              const SizedBox(height: 20),

              // By type
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('By Service Type',
                          style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 16),
                      if (sorted.isEmpty)
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text('No data', style: TextStyle(color: cs.onSurface.withOpacity(0.4))),
                          ),
                        )
                      else
                        ...sorted.map((st) {
                          final pct = totalSeconds > 0 ? st.seconds / totalSeconds : 0.0;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(children: [
                                      Icon(Icons.circle, size: 10, color: st.color),
                                      const SizedBox(width: 8),
                                      Text(st.name,
                                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                      const SizedBox(width: 4),
                                      Text('${st.count} entries',
                                          style: TextStyle(fontSize: 11, color: cs.onSurface.withOpacity(0.4))),
                                    ]),
                                    Text(_fmt(st.seconds),
                                        style: TextStyle(
                                            fontWeight: FontWeight.w700, color: st.color)),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                LinearProgressIndicator(
                                  value: pct,
                                  backgroundColor: st.color.withOpacity(0.1),
                                  valueColor: AlwaysStoppedAnimation(st.color),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                              ],
                            ),
                          );
                        }),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TypeStat {
  final String name;
  final Color color;
  final String icon;
  int seconds = 0;
  int count = 0;
  _TypeStat({required this.name, required this.color, required this.icon});
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  const _StatCard({required this.icon, required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(children: [
              Icon(icon, size: 14, color: cs.onSurface.withOpacity(0.5)),
              const SizedBox(width: 6),
              Flexible(
                child: Text(label,
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: cs.onSurface.withOpacity(0.5),
                        letterSpacing: 0.5)),
              ),
            ]),
            const SizedBox(height: 8),
            Text(value,
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w700,
                    color: cs.primary)),
          ],
        ),
      ),
    );
  }
}
