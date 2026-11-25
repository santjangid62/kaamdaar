import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class AdminApi {
  static const _storage = FlutterSecureStorage();
  static const _base = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://kaamdaar-seven.vercel.app',
  );

  static Future<bool> hasToken() async =>
      (await _storage.read(key: 'kaamdaar.superadmin.token'))?.isNotEmpty ?? false;

  static Future<void> logout() async {
    final token = await _token();
    if (token.isNotEmpty) {
      try {
        await http.post(
          Uri.parse('$_base/api/super-admin/mobile/logout'),
          headers: {'Authorization': 'Bearer $token'},
        );
      } catch (_) {
        // Local credentials are cleared even when the network is unavailable.
      }
    }
    await _storage.delete(key: 'kaamdaar.superadmin.token');
  }

  static Future<String> _token() async =>
      (await _storage.read(key: 'kaamdaar.superadmin.token')) ?? '';

  static Future<Map<String, dynamic>> _get(String path) async {
    final token = await _token();
    final response = await http.get(
      Uri.parse('$_base$path'),
      headers: {
        'Authorization': 'Bearer $token',
        'Cache-Control': 'no-store',
      },
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode == 401) {
      await logout();
      throw Exception('Session expired. Please sign in again.');
    }
    if (response.statusCode != 200) {
      throw Exception(data['error'] ?? 'Request failed');
    }
    return data;
  }

  static Future<void> login(String email, String password) async {
    final response = await http.post(
      Uri.parse('$_base/api/super-admin/mobile/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'email': email, 'password': password}),
    );
    final data = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode != 200) {
      throw Exception(data['error'] ?? 'Login failed');
    }
    await _storage.write(
      key: 'kaamdaar.superadmin.token',
      value: data['accessToken'] as String,
    );
  }

  static Future<Map<String, dynamic>> overview() =>
      _get('/api/super-admin/mobile/overview');

  static Future<Map<String, dynamic>> liveLocations() =>
      _get('/api/super-admin/mobile/live-locations');

  static Future<Map<String, dynamic>> collection(
    String name, {
    String query = '',
  }) {
    final encoded = Uri.encodeComponent(name);
    final search = query.trim().isEmpty
        ? ''
        : '?q=${Uri.encodeQueryComponent(query.trim())}';
    return _get('/api/super-admin/mobile/collections/$encoded$search');
  }
}
