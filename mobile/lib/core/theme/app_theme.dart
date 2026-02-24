import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

const _primary = Color(0xFF2094F3);
const _bgLight = Color(0xFFF5F7F8);
const _bgDark = Color(0xFF101A22);

class AppTheme {
  AppTheme._();

  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness brightness) {
    final isDark = brightness == Brightness.dark;
    final colorScheme = ColorScheme.fromSeed(
      seedColor: _primary,
      brightness: brightness,
      primary: _primary,
      background: isDark ? _bgDark : _bgLight,
      surface: isDark ? const Color(0xFF1E293B) : Colors.white,
    );

    return ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      scaffoldBackgroundColor: isDark ? _bgDark : _bgLight,
      textTheme: GoogleFonts.interTextTheme(
        ThemeData(brightness: brightness).textTheme,
      ),
      cardTheme: CardTheme(
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(
            color: isDark
                ? const Color(0xFF334155)
                : const Color(0xFFE2E8F0),
          ),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: isDark
            ? const Color(0xFF1E293B).withOpacity(0.9)
            : Colors.white.withOpacity(0.9),
        foregroundColor: isDark ? Colors.white : const Color(0xFF0F172A),
        elevation: 0,
        scrolledUnderElevation: 1,
        titleTextStyle: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: isDark ? Colors.white : const Color(0xFF0F172A),
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isDark ? const Color(0xFF1E293B) : Colors.white,
        indicatorColor: _primary.withOpacity(0.12),
        labelTextStyle: WidgetStateProperty.all(
          GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600),
        ),
      ),
      floatingActionButtonTheme: const FloatingActionButtonThemeData(
        backgroundColor: _primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: isDark
            ? const Color(0xFF334155)
            : const Color(0xFFF8FAFC),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? const Color(0xFF475569) : const Color(0xFFE2E8F0),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? const Color(0xFF475569) : const Color(0xFFE2E8F0),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: _primary, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    );
  }
}
