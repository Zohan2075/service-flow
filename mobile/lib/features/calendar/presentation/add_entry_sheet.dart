import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/network/dio_provider.dart';
import '../../../core/i18n/language_notifier.dart';
import '../../../core/i18n/translations.dart';
import '../providers/calendar_providers.dart';
import '../models/calendar_models.dart';

class AddEntrySheet extends ConsumerStatefulWidget {
  final DateTime selectedDate;
  const AddEntrySheet({super.key, required this.selectedDate});

  @override
  ConsumerState<AddEntrySheet> createState() => _AddEntrySheetState();
}

class _AddEntrySheetState extends ConsumerState<AddEntrySheet> {
  final _titleCtrl = TextEditingController();
  final _locationCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String? _selectedTypeId;
  late DateTime _startTime;
  late DateTime _endTime;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _startTime = DateTime(widget.selectedDate.year, widget.selectedDate.month,
        widget.selectedDate.day, 9, 0);
    _endTime = _startTime.add(const Duration(hours: 1));
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _locationCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickTime(bool isStart) async {
    final initial = isStart ? _startTime : _endTime;
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (picked == null) return;
    setState(() {
      final base = isStart ? _startTime : _endTime;
      final updated = base.copyWith(hour: picked.hour, minute: picked.minute);
      if (isStart) _startTime = updated; else _endTime = updated;
    });
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty || _selectedTypeId == null) return;
    setState(() => _saving = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/time-entries', data: {
        'title': _titleCtrl.text.trim(),
        'service_type_id': _selectedTypeId,
        'start_time': _startTime.toUtc().toIso8601String(),
        'end_time': _endTime.toUtc().toIso8601String(),
        'location': _locationCtrl.text.trim().isEmpty ? null : _locationCtrl.text.trim(),
        'notes': _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
      });
      ref.invalidate(calendarDataProvider);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to save: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    String t(String key) => tr(key, lang);
    final serviceTypesAsync = ref.watch(serviceTypesProvider);
    final theme = Theme.of(context);
    final cs = theme.colorScheme;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(t('entry.new'), style: theme.textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w700)),
                IconButton(onPressed: () => Navigator.of(context).pop(), icon: const Icon(Icons.close)),
              ],
            ),
            const SizedBox(height: 16),

            TextField(
              controller: _titleCtrl,
              decoration: InputDecoration(labelText: '${t('entry.title')} *'),
              textCapitalization: TextCapitalization.sentences,
            ),
            const SizedBox(height: 12),

            // Service type chips
            serviceTypesAsync.when(
              loading: () => const LinearProgressIndicator(),
              error: (_, __) => Text(t('entry.serviceType')),
              data: (types) => Wrap(
                spacing: 8,
                runSpacing: 8,
                children: types.map((st) {
                  final selected = _selectedTypeId == st.id;
                  final color = st.flutterColor;
                  return ChoiceChip(
                    label: Text(st.name),
                    selected: selected,
                    onSelected: (_) => setState(() => _selectedTypeId = st.id),
                    selectedColor: color,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : cs.onSurface,
                      fontWeight: FontWeight.w600,
                    ),
                    avatar: Icon(Icons.circle, size: 10, color: selected ? Colors.white : color),
                  );
                }).toList(),
              ),
            ),
            const SizedBox(height: 12),

            // Time selectors
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickTime(true),
                  icon: const Icon(Icons.schedule, size: 16),
                  label: Text(DateFormat('hh:mm a').format(_startTime)),
                ),
              ),
              const SizedBox(width: 8),
              const Text('→'),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _pickTime(false),
                  icon: const Icon(Icons.schedule, size: 16),
                  label: Text(DateFormat('hh:mm a').format(_endTime)),
                ),
              ),
            ]),
            const SizedBox(height: 12),

            TextField(
              controller: _locationCtrl,
              decoration: InputDecoration(labelText: t('entry.location')),
            ),
            const SizedBox(height: 12),

            TextField(
              controller: _notesCtrl,
              decoration: InputDecoration(labelText: t('entry.notes')),
              maxLines: 2,
            ),
            const SizedBox(height: 20),

            FilledButton(
              onPressed: _saving ? null : _save,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _saving
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(t('entry.add'), style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}
