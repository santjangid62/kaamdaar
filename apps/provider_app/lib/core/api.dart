/// HTTP client for the Kaamdaar backend, from the Professional's side.
///
/// Override the API host for a device/desktop run:
///   flutter run --dart-define=API_BASE=http://192.168.1.5:3100
library;

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geolocator/geolocator.dart';

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
    defaultValue: 'https://kaamdaar-seven.vercel.app',
  );

  static Future<Map<String, String>> _headers() async {
    final token = await FirebaseAuth.instance.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
  }

  static Map<String, dynamic> _decode(http.Response r) {
    final raw = r.body.isEmpty ? '{}' : r.body;
    try {
      final data = jsonDecode(raw);
      return data is Map<String, dynamic> ? data : <String, dynamic>{};
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  static Future<Map<String, dynamic>> post(String path, Map body) async {
    final r = await http
        .post(Uri.parse('$baseUrl$path'), headers: await _headers(), body: jsonEncode(body));
    final data = _decode(r);
    if (r.statusCode >= 400) {
      throw ApiException((data['error'] ?? 'Request failed').toString(), r.statusCode);
    }
    return data;
  }

  static Future<Map<String, dynamic>> get(String path) async {
    final r = await http.get(Uri.parse('$baseUrl$path'), headers: await _headers());
    final data = _decode(r);
    if (r.statusCode >= 400) {
      throw ApiException((data['error'] ?? 'Request failed').toString(), r.statusCode);
    }
    return data;
  }

  static Future<Map<String, dynamic>> patch(String path, Map body) async {
    final r = await http
        .patch(Uri.parse('$baseUrl$path'), headers: await _headers(), body: jsonEncode(body));
    final data = _decode(r);
    if (r.statusCode >= 400) {
      throw ApiException((data['error'] ?? 'Request failed').toString(), r.statusCode);
    }
    return data;
  }

  /* ----------------------------- auth ----------------------------- */

  /// Backend expects E.164 (+91XXXXXXXXXX) — accept any user input shape.
  static String e164(String phone) {
    final d = phone.replaceAll(RegExp(r'\D'), '');
    final ten = d.length > 10 ? d.substring(d.length - 10) : d;
    return '+91$ten';
  }

  static String? _phoneVerificationId;

  static Future<String> sendOtp(String phone) async {
    final auth = FirebaseAuth.instance;
    await auth.signOut();
    _phoneVerificationId = null;
    final completed = Completer<void>();
    await auth.verifyPhoneNumber(
      phoneNumber: e164(phone),
      timeout: const Duration(seconds: 60),
      verificationCompleted: (credential) async {
        try { await auth.signInWithCredential(credential); } catch (_) {}
        if (!completed.isCompleted) completed.complete();
      },
      verificationFailed: (error) {
        if (!completed.isCompleted) completed.completeError(
          ApiException(error.message ?? 'Firebase could not send OTP'));
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

  static Future<SessionUser> verifyOtp(String phone, String code) async {
    final auth = FirebaseAuth.instance;
    final current = auth.currentUser;
    if (current == null || e164(current.phoneNumber ?? '') != e164(phone)) {
      final verificationId = _phoneVerificationId;
      if (verificationId == null) throw ApiException('OTP session expired. Please resend.');
      await auth.signInWithCredential(PhoneAuthProvider.credential(
        verificationId: verificationId, smsCode: code.trim()));
    }
    final idToken = await auth.currentUser?.getIdToken(true);
    if (idToken == null) throw ApiException('Firebase phone verification did not complete.');
    final data = await post('/api/auth', {
      'action': 'verify', 'phone': e164(phone), 'idToken': idToken,
      'role': 'provider',
    });
    final provider = data['provider'];
    if (provider is! Map<String, dynamic>) {
      throw ApiException('Provider profile was not returned');
    }
    final user = SessionUser(
      id: (provider['id'] ?? '').toString(),
      phone: (provider['phone'] ?? e164(phone)).toString(),
      firstName: (provider['name'] ?? '').toString(),
    );
    await saveSession(user);
    _phoneVerificationId = null;
    return user;
  }

  /* --------------------------- session ---------------------------- */

  static const _kSession = 'kaamdaar.provider.session';
  static const _kOnboarded = 'kaamdaar.provider.onboarded';
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

  /// Register an FCM token only when Firebase proves the provider's phone.
  static Future<void> registerDeviceToken(String providerId, String token) async {
    final firebaseUser = FirebaseAuth.instance.currentUser;
    final rawFirebasePhone = firebaseUser?.phoneNumber ?? '';
    final firebasePhone = rawFirebasePhone.isEmpty ? '' : e164(rawFirebasePhone);
    final idToken = await firebaseUser?.getIdToken(true);
    if (idToken == null || firebasePhone.isEmpty) {
      throw ApiException('Please sign in again to enable job notifications.');
    }
    final session = await restoreSession();
    if (session == null || session.id != providerId || e164(session.phone) != firebasePhone) {
      throw ApiException('Provider account does not match the verified Firebase number.');
    }
    await post('/api/providers/device-token', {
      'providerId': providerId,
      'token': token,
      'platform': 'android',
      'idToken': idToken,
    });
  }

  /* --------------------------- catalogue --------------------------- */

  static Future<List<ServiceItem>> catalog() async {
    final data = await get('/api/catalog');
    return ((data['services'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(ServiceItem.fromJson)
        .toList();
  }

  /* --------------------------- my profile -------------------------- */

  /// Roster row tied to the signed-in phone (null until registration).
  static Future<ProviderItem?> me(String phone) async {
    final data = await get('/api/providers/me?phone=${Uri.encodeComponent(phone)}');
    final p = data['provider'];
    return p is Map<String, dynamic> ? ProviderItem.fromJson(p) : null;
  }

  static Future<ProviderItem> register(Map<String, dynamic> body) async {
    final data = await post('/api/providers/me', {
      ...body,
      if (body['phone'] != null) 'phone': e164('${body['phone']}'),
    });
    return ProviderItem.fromJson(
        (data['provider'] as Map<String, dynamic>?) ?? const {});
  }

  /* ----------------------------- jobs ------------------------------ */

  /// Offers still waiting for a reply (notify list) + jobs already allotted.
  static Future<List<BookingItem>> inbox(String providerId) async {
    final data =
        await get('/api/bookings?providerId=${Uri.encodeComponent(providerId)}');
    return ((data['bookings'] as List?) ?? [])
        .whereType<Map<String, dynamic>>()
        .map(BookingItem.fromJson)
        .toList();
  }

  static Future<BookingItem> updateJob(
      String id, Map<String, dynamic> changes) async {
    final data = await patch('/api/bookings/$id', {'patch': changes});
    return BookingItem.fromJson(
        (data['booking'] as Map<String, dynamic>?) ?? const {});
  }

  /// First accept wins: the server answers 409 to a second Pro, stamps the
  /// profile / start OTP / ETA and withdraws the offer from everyone else.
  static Future<BookingItem> accept(BookingItem b, ProviderItem me) async {
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      throw ApiException('Job accept karne ke liye location permission zaroori hai.');
    }
    if (!await Geolocator.isLocationServiceEnabled()) {
      throw ApiException('GPS on karein, phir job accept karein.');
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        timeLimit: Duration(seconds: 10),
      ),
    );
    return updateJob(b.id, {
      'status': 'accepted',
      'providerId': me.id,
      'providerAcceptPoint': {
        'lat': position.latitude,
        'lng': position.longitude,
        'accuracy': position.accuracy,
      },
      'enrouteAt': DateTime.now().millisecondsSinceEpoch,
    });
  }

  /// Drop the offer from this Pro's list only — the server removes just my id.
  static Future<BookingItem> decline(BookingItem b, String providerId) async {
    return updateJob(b.id, {'withdrawNotify': providerId});
  }

  /* ---------------------------- wallet ----------------------------- */

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

  static Future<void> recharge(String providerId, int amount) async {
    await post('/api/wallets/${Uri.encodeComponent(providerId)}',
        {'kind': 'recharge', 'amount': amount});
  }

  /// 10% platform commission, debited when a paid job is closed.
  static Future<void> commission(
      String providerId, int amount, {String? service}) async {
    final body = <String, dynamic>{
      'kind': 'commission',
      'amount': amount,
      'note': service == null ? '10% commission' : '10% commission — $service',
    };
    if (service != null) body['service'] = service;
    await post('/api/wallets/${Uri.encodeComponent(providerId)}', body);
  }
}
