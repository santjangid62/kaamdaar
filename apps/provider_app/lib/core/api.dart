/// HTTP client for the Kaamdaar backend, from the Professional's side.
///
/// Override the API host for a device/desktop run:
///   flutter run --dart-define=API_BASE=http://192.168.1.5:3100
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart' show kDebugMode;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
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
  static const FlutterSecureStorage _secureStorage = FlutterSecureStorage();
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

  static const String baseUrl = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://kaamdaar-seven.vercel.app',
  );

  static Future<Map<String, String>> _headers() async {
    final sessionToken = await _secureStorage.read(key: 'kaamdaar.device.session.token');
    if (sessionToken != null && sessionToken.isNotEmpty) {
      return {
        'Content-Type': 'application/json',
        'X-Kaamdaar-Client': 'mobile',
        'Authorization': 'Bearer $sessionToken',
      };
    }
    final firebaseToken = await FirebaseAuth.instance.currentUser?.getIdToken();
    return {
      'Content-Type': 'application/json',
      'X-Kaamdaar-Client': 'mobile',
      if (firebaseToken != null && firebaseToken.isNotEmpty)
        'Authorization': 'Bearer $firebaseToken',
    };
  }

  static Future<Map<String, dynamic>> _deviceDetails() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString('kaamdaar.device.installation.id');
    if (id == null || id.isEmpty) {
      final random = Random.secure();
      id = List.generate(40, (_) => random.nextInt(16).toRadixString(16)).join();
      await prefs.setString('kaamdaar.device.installation.id', id);
    }
    final name = Platform.isAndroid
        ? 'Android phone'
        : Platform.isIOS
            ? 'iPhone / iPad'
            : 'Mobile device';
    final details = <String, dynamic>{'deviceId': id, 'deviceName': name};
    try {
      final position = await Geolocator.getLastKnownPosition();
      if (position != null) {
        details['latitude'] = position.latitude;
        details['longitude'] = position.longitude;
        details['locationLabel'] = 'Last known GPS (${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)})';
      }
    } catch (_) {
      // Device location is optional for sign-in; the session records it when available.
    }
    return details;
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

  /// GET requests are safe to retry after transient mobile-network failures.
  /// Android can briefly lose DNS/connectivity while the app is backgrounded or
  /// the device is locked; retry without replaying any write operation.
  static Future<Map<String, dynamic>> get(String path) async {
    const delays = [Duration.zero, Duration(milliseconds: 500), Duration(seconds: 1)];
    for (var attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > Duration.zero) {
        await Future<void>.delayed(delays[attempt]);
      }
      try {
        final r = await http
            .get(Uri.parse('$baseUrl$path'), headers: await _headers())
            .timeout(const Duration(seconds: 15));
        final data = _decode(r);
        if (r.statusCode >= 500 && attempt < delays.length - 1) {
          continue;
        }
        if (r.statusCode >= 400) {
          throw ApiException((data['error'] ?? 'Request failed').toString(), r.statusCode);
        }
        return data;
      } on ApiException catch (error) {
        if (error.status == null || error.status! < 500 || attempt == delays.length - 1) {
          rethrow;
        }
      } on SocketException {
        // Retry after transient DNS/connectivity loss.
      } on TimeoutException {
        // Retry a timed-out safe GET request.
      } on http.ClientException {
        // Retry transient HTTP transport failures.
      }
    }
    throw ApiException(
      'Internet connection is temporarily unavailable. Please check your network and try again.',
    );
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

  static Future<SessionUser> verifyOtp(String phone, String code) async {
    if (_qaMobileAuthEnabled && kDebugMode) {
      final device = await _deviceDetails();
      final data = await post('/api/auth', {
        'action': 'qa_verify', 'phone': e164(phone), 'otp': code.trim(),
        'role': 'provider', 'platform': 'mobile_app', ...device,
      });
      final token = (data['sessionToken'] ?? '').toString();
      if (token.isEmpty) throw ApiException('QA session token was not returned.');
      await _secureStorage.write(key: 'kaamdaar.device.session.token', value: token);
      final provider = data['provider'];
      if (provider is! Map<String, dynamic>) throw ApiException('Provider profile was not returned');
      final user = SessionUser(
        id: (provider['id'] ?? '').toString(),
        phone: (provider['phone'] ?? e164(phone)).toString(),
        firstName: (provider['name'] ?? '').toString(),
      );
      await saveSession(user);
      return user;
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
    final device = await _deviceDetails();
    final data = await post('/api/auth', {
      'action': 'verify', 'phone': e164(phone), 'idToken': idToken,
      'role': 'provider', 'platform': 'mobile_app', ...device,
    });
    final sessionToken = (data['sessionToken'] ?? '').toString();
    if (sessionToken.isEmpty) throw ApiException('Secure device session was not returned.');
    await _secureStorage.write(key: 'kaamdaar.device.session.token', value: sessionToken);
    final provider = data['provider'];
    if (provider is! Map<String, dynamic>) throw ApiException('Provider profile was not returned');
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
    final token = await _secureStorage.read(key: 'kaamdaar.device.session.token');
    if (raw == null || token == null || token.isEmpty) return null;
    try {
      await get('/api/auth/session');
    } on ApiException catch (error) {
      if (error.status == 401) {
        await p.remove(_kSession);
        await _secureStorage.delete(key: 'kaamdaar.device.session.token');
        return null;
      }
    } catch (_) {
      // Keep the local session on temporary network failure; protected API
      // calls still validate the server session before returning account data.
    }
    final j = jsonDecode(raw);
    if (j is! Map<String, dynamic>) return null;
    cached = SessionUser.fromJson(j);
    return cached;
  }

  static Future<void> clearSession() async {
    try {
      await http.delete(Uri.parse('$baseUrl/api/auth/session'), headers: await _headers());
    } catch (_) {
      // Local logout must still complete if the network is unavailable.
    }
    cached = null;
    final p = await SharedPreferences.getInstance();
    await p.remove(_kSession);
    await p.remove('kaamdaar.qa.mobile.token');
    await _secureStorage.delete(key: 'kaamdaar.device.session.token');
  }

  static Future<Map<String, dynamic>> createPairingCode() async {
    return post('/api/auth/session/pairing', const {});
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
    final session = await restoreSession();
    if (session == null || session.id != providerId) {
      throw ApiException('Please sign in again to enable job notifications.');
    }
    final firebaseUser = FirebaseAuth.instance.currentUser;
    final rawFirebasePhone = firebaseUser?.phoneNumber ?? '';
    final firebasePhone = rawFirebasePhone.isEmpty ? '' : e164(rawFirebasePhone);
    final idToken = _qaMobileAuthEnabled ? null : await firebaseUser?.getIdToken(true);
    if (!_qaMobileAuthEnabled && idToken != null && firebasePhone != e164(session.phone)) {
      throw ApiException('Provider account does not match the verified phone number.');
    }
    await post('/api/providers/device-token', {
      'providerId': providerId,
      'token': token,
      'platform': 'android',
      if (idToken != null) 'idToken': idToken,
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

  static Future<void> setAvailability(bool online) async {
    await patch("/api/providers/me", {"availabilityStatus": online ? "available" : "offline"});
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
      String id, Map<String, dynamic> changes, {String? completionOtp}) async {
    final data = await patch('/api/bookings/$id', {
      if (completionOtp != null) 'completionOtp': completionOtp,
      'patch': changes,
    });
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
