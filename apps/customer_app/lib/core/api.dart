/// HTTP client for the Kaamdaar Next.js backend.
library;
///
/// The API base URL defaults to the Android emulator loopback; override it
/// for a device or desktop run:
///   flutter run --dart-define=API_BASE=http://192.168.1.5:3100
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class ApiException implements Exception {
  final String message;
  final int? status;
  ApiException(this.message, [this.status]);
  @override
  String toString() => message;
}

class Api {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'http://10.0.2.2:3100',
  );

  static const Map<String, String> _headers = {'Content-Type': 'application/json'};

  static Future<Map<String, dynamic>> _decode(http.Response r) async {
    final data = jsonDecode(r.body.isEmpty ? '{}' : r.body);
    if (data is! Map<String, dynamic>) return <String, dynamic>{};
    return data;
  }

  static Future<Map<String, dynamic>> post(String path, Map body) async {
    final r = await http.post(Uri.parse('$baseUrl$path'),
        headers: _headers, body: jsonEncode(body));
    final data = await _decode(r);
    if (r.statusCode >= 400) {
      throw ApiException((data['error'] ?? 'Request failed').toString(), r.statusCode);
    }
    return data;
  }

  static Future<Map<String, dynamic>> get(String path) async {
    final r = await http.get(Uri.parse('$baseUrl$path'), headers: _headers);
    final data = await _decode(r);
    if (r.statusCode >= 400) {
      throw ApiException((data['error'] ?? 'Request failed').toString(), r.statusCode);
    }
    return data;
  }

  static Future<Map<String, dynamic>> patch(String path, Map body) async {
    final r = await http.patch(Uri.parse('$baseUrl$path'),
        headers: _headers, body: jsonEncode(body));
    final data = await _decode(r);
    if (r.statusCode >= 400) {
      throw ApiException((data['error'] ?? 'Request failed').toString(), r.statusCode);
    }
    return data;
  }

  /* ---------------------------- auth ---------------------------- */

  /// Backend expects E.164 (+91XXXXXXXXXX) — accept any user input shape.
  static String e164(String phone) {
    final d = phone.replaceAll(RegExp(r'\D'), '');
    final ten = d.length > 10 ? d.substring(d.length - 10) : d;
    return '+91$ten';
  }

  static bool isValidIndianMobile(String phone) {
    final digits = phone.replaceAll(RegExp(r'\D'), '');
    final mobile = digits.startsWith('91') && digits.length == 12
        ? digits.substring(2)
        : digits;
    return RegExp(r'^[6-9]\d{9}$').hasMatch(mobile);
  }

  static Future<String> sendOtp(String phone) async {
    final data = await post('/api/auth', {'action': 'send', 'phone': e164(phone)});
    return (data['devCode'] ?? '').toString();
  }

  static Future<SessionUser> verifyOtp(String phone, String code) async {
    final data = await post(
        '/api/auth', {'action': 'verify', 'phone': e164(phone), 'code': code});
    final user = SessionUser.fromJson(
        (data['user'] as Map<String, dynamic>?) ?? const {});
    await saveSession(user);
    return user;
  }

  /* -------------------------- session --------------------------- */

  static const _kSession = 'kaamdaar.customer.session';
  static const _kOnboarded = 'kaamdaar.onboarded';
  static SessionUser? cached;

  static Future<void> saveSession(SessionUser user) async {
    cached = user;
    final p = await SharedPreferences.getInstance();
    await p.setString(_kSession, jsonEncode(user.toJson()));
  }

  static Future<SessionUser?> restoreSession() async {
    if (cached != null) return cached;
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_kSession);
    if (raw == null) return null;
    final j = jsonDecode(raw);
    if (j is! Map<String, dynamic>) return null;
    cached = SessionUser.fromJson(j);
    return cached;
  }

  static Future<void> clearSession() async {
    cached = null;
    final p = await SharedPreferences.getInstance();
    await p.remove(_kSession);
  }

  static Future<bool> get onboarded async {
    final p = await SharedPreferences.getInstance();
    return p.getBool(_kOnboarded) ?? false;
  }

  static Future<void> setOnboarded() async {
    final p = await SharedPreferences.getInstance();
    await p.setBool(_kOnboarded, true);
  }

  /* ------------------------- catalogue -------------------------- */

  /// `lat`/`lng` make the catalogue area-aware: services a nearby Pro covers
  /// come back first, every other service still follows in the same list.
  static Future<List<ServiceItem>> catalog({double? lat, double? lng}) async {
    final q = (lat != null && lng != null) ? '?lat=$lat&lng=$lng' : '';
    final data = await get('/api/catalog$q');
    return ((data['services'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(ServiceItem.fromJson)
        .toList();
  }

  static Future<List<String>> categories() async {
    final data = await get('/api/catalog');
    return ((data['categories'] as List?) ?? []).map((e) => '$e').toList();
  }

  /* -------------------------- providers ------------------------- */

  static Future<List<ProviderItem>> nearby(
      String serviceId, double lat, double lng,
      {double radiusKm = 3}) async {
    final q = Uri.encodeComponent(serviceId);
    final data = await get(
        '/api/providers?serviceId=$q&lat=$lat&lng=$lng&radiusKm=$radiusKm');
    return ((data['providers'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map((row) => ProviderItem.fromJson(
            (row['provider'] as Map<String, dynamic>?) ?? const {},
            distance: (row['distanceKm'] is num)
                ? (row['distanceKm'] as num).toDouble()
                : 0))
        .toList();
  }

  /* -------------------------- addresses ------------------------- */

  static Future<List<AddressItem>> addresses(String userId) async {
    final data = await get('/api/users/${Uri.encodeComponent(userId)}/addresses');
    final list = (data['addresses'] as List?) ?? (data as List? ?? []);
    return list
        .whereType<Map<String, dynamic>>()
        .map(AddressItem.fromJson)
        .toList();
  }

  static Future<List<AddressItem>> addAddress(
      String userId, Map<String, dynamic> body) async {
    final data =
        await post('/api/users/${Uri.encodeComponent(userId)}/addresses', body);
    return ((data['addresses'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(AddressItem.fromJson)
        .toList();
  }

  static Future<void> deleteAddress(String userId, String addressId) async {
    final r = await http.delete(Uri.parse(
        '$baseUrl/api/users/${Uri.encodeComponent(userId)}/addresses/${Uri.encodeComponent(addressId)}'));
    if (r.statusCode >= 400) {
      throw ApiException('Could not remove address', r.statusCode);
    }
  }

  /* -------------------------- bookings -------------------------- */

  static Future<BookingItem> createBooking(Map body) async {
    final data = await post('/api/bookings', body);
    return BookingItem.fromJson(
        (data['booking'] as Map<String, dynamic>?) ?? const {});
  }

  static Future<List<BookingItem>> userBookings(String userId) async {
    final data = await get('/api/bookings?userId=${Uri.encodeComponent(userId)}');
    return ((data['bookings'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(BookingItem.fromJson)
        .toList();
  }

  static Future<BookingItem?> booking(String userId, String id) async {
    final all = await userBookings(userId);
    for (final b in all) {
      if (b.id == id) return b;
    }
    return null;
  }

  static Future<BookingItem> updateBooking(
      String userId, String id, Map<String, dynamic> changes) async {
    final data = await patch('/api/bookings/$id',
        {'userId': userId, 'patch': changes});
    return BookingItem.fromJson(
        (data['booking'] as Map<String, dynamic>?) ?? const {});
  }

  /* --------------------------- wallet --------------------------- */

  static Future<WalletInfo> wallet(String providerId) async {
    final data = await get('/api/wallets/${Uri.encodeComponent(providerId)}');
    return WalletInfo.fromJson(
        (data['wallet'] as Map<String, dynamic>?) ?? const {});
  }

  static Future<List<WalletTxn>> walletTxns(String providerId) async {
    final data = await get('/api/wallets/${Uri.encodeComponent(providerId)}');
    return ((data['txns'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(WalletTxn.fromJson)
        .toList();
  }

  static Future<void> rechargeWallet(String providerId, int amount) async {
    await post('/api/wallets/${Uri.encodeComponent(providerId)}',
        {'kind': 'recharge', 'amount': amount});
  }

  /// 10% company commission — debited the moment a paid service closes.
  static Future<void> debitCommission(
      String providerId, int amount, String note) async {
    await post('/api/wallets/${Uri.encodeComponent(providerId)}',
        {'kind': 'commission', 'amount': amount, 'note': note});
  }
}
