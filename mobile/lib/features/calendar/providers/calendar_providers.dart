import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_provider.dart';
import '../models/calendar_models.dart';

// Service types
final serviceTypesProvider = FutureProvider<List<ServiceType>>((ref) async {
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/service-types');
  return (resp.data as List)
      .map((e) => ServiceType.fromJson(e as Map<String, dynamic>))
      .toList();
});

// Calendar data for selected month
final selectedMonthProvider = StateProvider<DateTime>((ref) => DateTime.now());

final calendarDataProvider = FutureProvider<List<CalendarDay>>((ref) async {
  final date = ref.watch(selectedMonthProvider);
  final dio = ref.read(dioProvider);
  final resp = await dio.get('/time-entries/calendar', queryParameters: {
    'month': date.month,
    'year': date.year,
  });
  return (resp.data as List)
      .map((e) => CalendarDay.fromJson(e as Map<String, dynamic>))
      .toList();
});

// Selected day
final selectedDayProvider = StateProvider<DateTime>((ref) => DateTime.now());
