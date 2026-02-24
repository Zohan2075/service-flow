import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/theme_mode_notifier.dart';
import '../../../features/auth/providers/auth_providers.dart';
import '../../../features/calendar/providers/calendar_providers.dart';
import '../../../core/network/dio_provider.dart';

const _colors = [
  '#2094f3', '#f97316', '#10b981', '#8b5cf6',
  '#ef4444', '#ec4899', '#14b8a6', '#f59e0b',
];

const _icons = [
  'build', 'groups', 'analytics', 'computer',
  'phone_in_talk', 'drive_eta', 'home_repair_service', 'medical_services',
];

class SettingsPage extends ConsumerStatefulWidget {
  const SettingsPage({super.key});
  @override
  ConsumerState<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends ConsumerState<SettingsPage> {
  final _nameCtrl = TextEditingController();
  String _selectedColor = _colors[0];
  String _selectedIcon = _icons[0];
  bool _creating = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    super.dispose();
  }

  Color _hexColor(String hex) {
    final h = hex.replaceAll('#', '');
    return Color(int.parse('FF$h', radix: 16));
  }

  IconData _iconData(String name) {
    const map = {
      'build': Icons.build,
      'groups': Icons.groups,
      'analytics': Icons.analytics,
      'computer': Icons.computer,
      'phone_in_talk': Icons.phone_in_talk,
      'drive_eta': Icons.drive_eta,
      'home_repair_service': Icons.home_repair_service,
      'medical_services': Icons.medical_services,
    };
    return map[name] ?? Icons.work;
  }

  Future<void> _createServiceType() async {
    if (_nameCtrl.text.trim().isEmpty) return;
    setState(() => _creating = true);
    try {
      final dio = ref.read(dioProvider);
      await dio.post('/service-types', data: {
        'name': _nameCtrl.text.trim(),
        'color': _selectedColor,
        'icon': _selectedIcon,
      });
      ref.invalidate(serviceTypesProvider);
      _nameCtrl.clear();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Service type created!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _creating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cs = theme.colorScheme;
    final themeMode = ref.watch(themeModeProvider);
    final serviceTypesAsync = ref.watch(serviceTypesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Appearance
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Appearance', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  Row(children: [
                    for (final mode in [ThemeMode.light, ThemeMode.dark, ThemeMode.system])
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: OutlinedButton(
                            onPressed: () => ref.read(themeModeProvider.notifier).setMode(mode),
                            style: OutlinedButton.styleFrom(
                              backgroundColor: themeMode == mode ? cs.primary.withOpacity(0.1) : null,
                              side: BorderSide(color: themeMode == mode ? cs.primary : cs.outline),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            child: Text(
                              mode.name[0].toUpperCase() + mode.name.substring(1),
                              style: TextStyle(
                                color: themeMode == mode ? cs.primary : cs.onSurface,
                                fontWeight: FontWeight.w600,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ]),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Service Types
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Service Types', style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: 12),
                  serviceTypesAsync.when(
                    loading: () => const LinearProgressIndicator(),
                    error: (e, _) => Text('Error: $e'),
                    data: (types) => types.isEmpty
                        ? Text('No service types yet', style: TextStyle(color: cs.onSurface.withOpacity(0.4)))
                        : Column(
                            children: types.map((st) => ListTile(
                              contentPadding: EdgeInsets.zero,
                              leading: Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: st.flutterColor.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(_iconData(st.icon), color: st.flutterColor, size: 18),
                              ),
                              title: Text(st.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                              trailing: IconButton(
                                icon: const Icon(Icons.delete_outline, size: 18),
                                color: cs.error,
                                onPressed: () async {
                                  final dio = ref.read(dioProvider);
                                  await dio.delete('/service-types/${st.id}');
                                  ref.invalidate(serviceTypesProvider);
                                },
                              ),
                            )).toList(),
                          ),
                  ),
                  const Divider(height: 24),
                  Text('Add New', style: theme.textTheme.labelLarge?.copyWith(
                    color: cs.onSurface.withOpacity(0.5),
                    letterSpacing: 0.5,
                  )),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _nameCtrl,
                    decoration: const InputDecoration(labelText: 'Name'),
                  ),
                  const SizedBox(height: 12),
                  // Color picker
                  Text('Color', style: theme.textTheme.labelMedium?.copyWith(color: cs.onSurface.withOpacity(0.5))),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: _colors.map((c) => GestureDetector(
                      onTap: () => setState(() => _selectedColor = c),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        width: 32, height: 32,
                        decoration: BoxDecoration(
                          color: _hexColor(c),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _selectedColor == c ? cs.onSurface : Colors.transparent,
                            width: 2.5,
                          ),
                        ),
                      ),
                    )).toList(),
                  ),
                  const SizedBox(height: 12),
                  // Icon picker
                  Text('Icon', style: theme.textTheme.labelMedium?.copyWith(color: cs.onSurface.withOpacity(0.5))),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _icons.map((ic) => GestureDetector(
                      onTap: () => setState(() => _selectedIcon = ic),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 150),
                        width: 40, height: 40,
                        decoration: BoxDecoration(
                          color: _selectedIcon == ic ? cs.primary.withOpacity(0.12) : cs.surface,
                          border: Border.all(
                            color: _selectedIcon == ic ? cs.primary : cs.outline,
                          ),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(_iconData(ic),
                            size: 18,
                            color: _selectedIcon == ic ? cs.primary : cs.onSurface.withOpacity(0.5)),
                      ),
                    )).toList(),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _creating ? null : _createServiceType,
                      style: FilledButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _creating
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text('Create', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Sign out
          Card(
            child: ListTile(
              leading: const Icon(Icons.logout, color: Colors.red),
              title: const Text('Sign Out', style: TextStyle(color: Colors.red, fontWeight: FontWeight.w600)),
              onTap: () => ref.read(authNotifierProvider.notifier).logout(),
            ),
          ),
        ],
      ),
    );
  }
}
