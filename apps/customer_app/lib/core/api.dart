/// HTTP client for the Kaamdaar Next.js backend.
library;
///
/// The API base URL defaults to the Android emulator loopback; override it
/// for a device or desktop run:
///   flutter run --dart-define=API_BASE=http://192.168.1.5:3100
import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:firebase_auth/firebase_auth.dart';
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
  // Enabled only for explicitly-built QA debug APKs. Production release builds
  // keep Firebase app verification enabled.
  static const bool _firebasePhoneAuthTesting = bool.fromEnvironment(
    'FIREBASE_PHONE_AUTH_TESTING',
    defaultValue: false,
  );

  static const bool _qaMobileAuthEnabled = bool.fromEnvironment(
    'QA_MOBILE_AUTH',
    defaultValue: false,
  );
  static String? _qaBearerToken;

  static const String baseUrl = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://kaamdaar-seven.vercel.app',
  );

  static Future<Map<String, String>> _headers() async {
    final prefs = await SharedPreferences.getInstance();
    final qaToken = _qaBearerToken ?? prefs.getString('kaamdaar.qa.mobile.token');
    if (_qaMobileAuthEnabled && qaToken != null && qaToken.isNotEmpty) {
      _qaBearerToken = qaToken;
      return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $qaToken',
      };
    }
    final firebaseToken = await FirebaseAuth.instance.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      if (firebaseToken != null && firebaseToken.isNotEmpty)
        'Authorization': 'Bearer $firebaseToken',
    };
  }

  static Future<Map<String, dynamic>> _decode(http.Response r) async {
    final data = jsonDecode(r.body.isEmpty ? '{}' : r.body);
    if (data is! Map<String, dynamic>) return <String, dynamic>{};
    return data;
  }

  static Future<Map<String, dynamic>> post(String path, Map body) async {
    final r = await http.post(Uri.parse('$baseUrl$path'),
        headers: await _headers(), body: jsonEncode(body));
    final data = await _decode(r);
    if (r.statusCode >= 400) {
      throw ApiException((data['error'] ?? 'Request failed').toString(), r.statusCode);
    }
    return data;
  }

  static Future<Map<String, dynamic>> get(String path) async {
    final r = await http.get(Uri.parse('$baseUrl$path'), headers: await _headers());
    final data = await _decode(r);
    if (r.statusCode >= 400) {
      throw ApiException((data['error'] ?? 'Request failed').toString(), r.statusCode);
    }
    return data;
  }

  static Future<Map<String, dynamic>> patch(String path, Map body) async {
    final r = await http.patch(Uri.parse('$baseUrl$path'),
        headers: await _headers(), body: jsonEncode(body));
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

  static String? _phoneVerificationId;

  static Future<String> sendOtp(String phone) async {
    _phoneVerificationId = null;
    if (_qaMobileAuthEnabled && kDebugMode) {
      await FirebaseAuth.instance.signOut();
      return '123456';
    }
    final auth = FirebaseAuth.instance;
    await auth.signOut();
    if (kDebugMode && _firebasePhoneAuthTesting) {
      await auth.setSettings(appVerificationDisabledForTesting: true);
    }
    final completed = Completer<void>();
    await auth.verifyPhoneNumber(
      phoneNumber: e164(phone),
      timeout: const Duration(seconds: 60),
      verificationCompleted: (credential) async {
        try { await auth.signInWithCredential(credential); } catch (_) {}
        if (!completed.isCompleted) completed.complete();
      },
      verificationFailed: (error) {
        final rawMessage = error.message ?? '';
        final isAndroidClientBlocked = rawMessage.contains('are blocked') ||
            rawMessage.contains('API_KEY_ANDROID_APP_BLOCKED');
        final message = isAndroidClientBlocked
            ? 'Firebase has blocked this Android build. Add this app package name and the QA APK signing SHA-1 in Firebase Project Settings and Google Cloud > APIs & Services > Credentials > Firebase Android API key restrictions, then rebuild the APK.'
            : switch (error.code) {
          'billing-not-enabled' || 'auth/billing-not-enabled' =>
            'Firebase billing is not enabled. For QA, use a fictional number configured in Firebase Console and install the QA debug APK.',
          'invalid-phone-number' => 'Enter a valid Indian mobile number.',
          'too-many-requests' => 'Firebase temporarily limited sign-in attempts. Please try again later.',
          _ => 'Firebase verification failed (${error.code}): ${error.message ?? 'Please try again.'}',
        };
        if (!completed.isCompleted) completed.completeError(ApiException(message));
      },
      codeSent: (verificationId, resendToken) {
        _phoneVerificationId = verificationId;
        if (!completed.isCompleted) completed.complete();
      },
      codeAutoRetrievalTimeout: (verificationId) {
        _phoneVerificationId = verificationId;
        if (!completed.isCompleted) completed.complete();
      },
    );
    await completed.future;
    return '';
  }

  static Future<({SessionUser user, bool isNew})> verifyOtp(String phone, String code) async {
    if (_qaMobileAuthEnabled && kDebugMode) {
      final data = await post('/api/auth', {
        'action': 'qa_verify', 'phone': e164(phone), 'otp': code.trim(),
        'role': 'customer', 'platform': 'mobile_app',
      });
      final token = (data['sessionToken'] ?? '').toString();
      if (token.isEmpty) throw ApiException('QA session token was not returned.');
      _qaBearerToken = token;
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('kaamdaar.qa.mobile.token', token);
      final user = SessionUser.fromJson((data['user'] as Map<String, dynamic>?) ?? const {});
      await saveSession(user);
      return (user: user, isNew: data['isNew'] == true);
    }
    final auth = FirebaseAuth.instance;
    final current = auth.currentUser;
    if (current == null || e164(current.phoneNumber ?? '') != e164(phone)) {
      final verificationId = _phoneVerificationId;
      if (verificationId == null) throw ApiException('OTP session expired. Please resend.');
      await auth.signInWithCredential(PhoneAuthProvider.credential(verificationId: verificationId, smsCode: code.trim()));
    }
    final idToken = await auth.currentUser?.getIdToken(true);
    if (idToken == null) throw ApiException('Firebase phone verification did not complete.');
    final data = await post('/api/auth', {
      'action': 'verify', 'phone': e164(phone), 'idToken': idToken, 'platform': 'mobile_app',
    });
    final user = SessionUser.fromJson((data['user'] as Map<String, dynamic>?) ?? const {});
    await saveSession(user);
    _phoneVerificationId = null;
    return (user: user, isNew: data['isNew'] == true);
  }
  /// Fetch the latest customer profile from the shared backend.
  static Future<SessionUser> refreshProfile(String phone) async {
    final data = await get('/api/users/resolve?phone=${Uri.encodeQueryComponent(e164(phone))}');
    final user = SessionUser.fromJson((data['user'] as Map<String, dynamic>?) ?? const {});
    await saveSession(user);
    return user;
  }

  /// Update customer profile through the shared backend.
  static Future<SessionUser> updateProfile(String id, Map<String, dynamic> body) async {
    final data = await patch('/api/users/${Uri.encodeComponent(id)}', body);
    final user = SessionUser.fromJson((data['user'] as Map<String, dynamic>?) ?? const {});
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
    await p.remove('kaamdaar.qa.mobile.token');
    _qaBearerToken = null;
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

  static Future<void> submitReview({
    required String bookingId,
    required int providerRating,
    required int serviceRating,
    String text = '',
  }) async {
    await post('/api/reviews', {
      'bookingId': bookingId,
      'providerRating': providerRating,
      'serviceRating': serviceRating,
      'text': text,
    });
  }

  static Future<BookingItem> updateBooking(
      String userId, String id, Map<String, dynamic> changes,
      {String? completionOtp}) async {
    final data = await patch('/api/bookings/$id', {
      'userId': userId,
      if (completionOtp != null) 'completionOtp': completionOtp,
      'patch': changes,
    });
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
