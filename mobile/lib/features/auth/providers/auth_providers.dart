import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import '../../../core/network/dio_provider.dart';

const _storage = FlutterSecureStorage();

final _googleSignIn = GoogleSignIn(scopes: ['email', 'profile']);

// Represents logged-in user info
class AuthUser {
  final String userId;
  final String email;
  final String? name;
  final String? avatarUrl;
  const AuthUser({required this.userId, required this.email, this.name, this.avatarUrl});
}

// Auth state: null = not logged in
final authStateProvider = FutureProvider<AuthUser?>((ref) async {
  final token = await _storage.read(key: 'access_token');
  if (token == null) return null;
  try {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/auth/me');
    final d = resp.data as Map<String, dynamic>;
    return AuthUser(
      userId: d['id'] as String,
      email: d['email'] as String,
      name: d['full_name'] as String?,
      avatarUrl: d['avatar_url'] as String?,
    );
  } catch (_) {
    await _storage.deleteAll();
    return null;
  }
});

// Auth actions notifier
class AuthNotifier extends AsyncNotifier<AuthUser?> {
  @override
  Future<AuthUser?> build() async => null;

  Future<void> loginWithGoogle() async {
    final account = await _googleSignIn.signIn();
    if (account == null) return;
    final auth = await account.authentication;
    final idToken = auth.idToken;
    if (idToken == null) throw Exception('No ID token');

    final dio = ref.read(dioProvider);
    final resp = await dio.post('/auth/google', data: {'id_token': idToken});
    await _saveTokens(resp.data);
    final user = await _fetchMe();
    state = AsyncData(user);
  }

  Future<void> loginWithEmail(String email, String password) async {
    final dio = ref.read(dioProvider);
    final resp = await dio.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
    await _saveTokens(resp.data);
    final user = await _fetchMe();
    state = AsyncData(user);
  }

  Future<void> logout() async {
    await _googleSignIn.signOut();
    await _storage.deleteAll();
    state = const AsyncData(null);
  }

  Future<void> _saveTokens(Map<String, dynamic> data) async {
    await _storage.write(key: 'access_token', value: data['access_token'] as String);
    await _storage.write(key: 'refresh_token', value: data['refresh_token'] as String);
  }

  Future<AuthUser?> _fetchMe() async {
    final dio = ref.read(dioProvider);
    final resp = await dio.get('/auth/me');
    final d = resp.data as Map<String, dynamic>;
    return AuthUser(
      userId: d['id'] as String,
      email: d['email'] as String,
      name: d['full_name'] as String?,
      avatarUrl: d['avatar_url'] as String?,
    );
  }
}

final authNotifierProvider = AsyncNotifierProvider<AuthNotifier, AuthUser?>(
  AuthNotifier.new,
);
