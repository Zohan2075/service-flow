import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _baseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:8000/api/v1', // Android emulator → localhost
);

const _storage = FlutterSecureStorage();

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: _baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Content-Type': 'application/json'},
  ));

  // Attach JWT token
  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'access_token');
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          // Token expired — try refresh
          final refreshToken = await _storage.read(key: 'refresh_token');
          if (refreshToken != null) {
            try {
              final resp = await Dio().post(
                '$_baseUrl/auth/refresh',
                data: {'refresh_token': refreshToken},
              );
              final newToken = resp.data['access_token'] as String;
              await _storage.write(key: 'access_token', value: newToken);
              // Retry original request
              error.requestOptions.headers['Authorization'] = 'Bearer $newToken';
              final retried = await dio.fetch(error.requestOptions);
              return handler.resolve(retried);
            } catch (_) {
              await _storage.deleteAll();
            }
          }
        }
        handler.next(error);
      },
    ),
  );

  return dio;
});
