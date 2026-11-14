import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'api.dart';
import 'job_alerts.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp();
  }
}

/// Registers the Provider device with the Kaamdaar backend and wakes the
/// existing 40-second full-screen offer watcher when a push arrives.
class ProviderPushNotifications {
  ProviderPushNotifications._();
  static final ProviderPushNotifications instance = ProviderPushNotifications._();

  StreamSubscription<String>? _tokenSubscription;
  StreamSubscription<RemoteMessage>? _messageSubscription;
  StreamSubscription<RemoteMessage>? _openedSubscription;
  String? _registeredProviderId;

  Future<void> initialize(String providerId) async {
    if (Firebase.apps.isEmpty || providerId.isEmpty) return;
    if (_registeredProviderId == providerId) return;
    _registeredProviderId = providerId;

    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true);
    await messaging.setAutoInitEnabled(true);

    Future<void> register(String token) async {
      if (token.isEmpty) return;
      try {
        await Api.registerDeviceToken(providerId, token);
      } catch (_) {
        // Retry on the next token refresh or app launch.
      }
    }

    final token = await messaging.getToken();
    if (token != null) await register(token);

    await _tokenSubscription?.cancel();
    _tokenSubscription = messaging.onTokenRefresh.listen(register);

    await _messageSubscription?.cancel();
    _messageSubscription = FirebaseMessaging.onMessage.listen((_) {
      JobAlertCenter.instance.checkNow();
    });

    await _openedSubscription?.cancel();
    _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen((_) {
      JobAlertCenter.instance.checkNow();
    });

    final initial = await messaging.getInitialMessage();
    if (initial != null) {
      // ProviderShell starts the inbox watcher as soon as the app is opened.
      unawaited(JobAlertCenter.instance.checkNow());
    }
  }
}
