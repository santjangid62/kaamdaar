import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
class AdminApi {
 static const _storage=FlutterSecureStorage();
 static const _base=String.fromEnvironment('API_BASE',defaultValue:'https://kaamdaar-seven.vercel.app');
 static Future<bool> hasToken() async => (await _storage.read(key:'kaamdaar.superadmin.token'))?.isNotEmpty ?? false;
 static Future<void> logout() async { await _storage.delete(key:'kaamdaar.superadmin.token'); }
 static Future<void> login(String email,String password) async {
  final r=await http.post(Uri.parse('$_base/api/super-admin/mobile/login'),headers:{'Content-Type':'application/json'},body:jsonEncode({'email':email,'password':password}));
  final d=jsonDecode(r.body) as Map<String,dynamic>;
  if(r.statusCode!=200) throw Exception(d['error'] ?? 'Login failed');
  await _storage.write(key:'kaamdaar.superadmin.token',value:d['accessToken'] as String);
 }
 static Future<Map<String,dynamic>> overview() async {
  final token=await _storage.read(key:'kaamdaar.superadmin.token');
  final r=await http.get(Uri.parse('$_base/api/super-admin/mobile/overview'),headers:{'Authorization':'Bearer $token','Cache-Control':'no-store'});
  final d=jsonDecode(r.body) as Map<String,dynamic>;
  if(r.statusCode==401){await logout();throw Exception('Session expired. Please sign in again.');}
  if(r.statusCode!=200) throw Exception(d['error'] ?? 'Could not load dashboard');
  return d;
 }
}
