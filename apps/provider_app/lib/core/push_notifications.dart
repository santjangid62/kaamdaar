import 'dart:async';
import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'api.dart';
import 'job_alerts.dart';

const String _jobChannelId = 'kaamdaar_job_alerts_v2';
const String _jobChannelName = 'Kaamdaar new job requests';
final FlutterLocalNotificationsPlugin _localNotifications =
    FlutterLocalNotificationsPlugin();

int _notificationId(String bookingId) => bookingId.codeUnits.fold<int>(
      0,
      (value, unit) => (value * 31 + unit) & 0x7fffffff,
    );

Future<void> _prepareLocalNotifications() async {
  await _localNotifications.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    ),
  );
  final android = _localNotifications.resolvePlatformSpecificImplementation<
      AndroidFlutterLocalNotificationsPlugin>();
  await android?.createNotificationChannel(
    const AndroidNotificationChannel(
      _jobChannelId,
      _jobChannelName,
      description: 'Audible alerts for incoming Kaamdaar provider jobs',
      importance: Importance.max,
      playSound: true,
      sound: RawResourceAndroidNotificationSound('job_alert'),
      enableVibration: true,
    ),
  );
}

Future<void> _showBackgroundOffer(RemoteMessage message) async {
  final bookingId = message.data['bookingId']?.toString() ?? '';
  if (bookingId.isEmpty) return;
  await _prepareLocalNotifications();
  await _localNotifications.show(
    _notificationId(bookingId),
    message.data['title']?.toString() ?? 'New Kaamdaar job request',
    message.data['body']?.toString() ?? 'Open Kaamdaar Provider to accept within 40 seconds.',
    const NotificationDetails(
      android: AndroidNotificationDetails(
        _jobChannelId,
        _jobChannelName,
        channelDescription: 'Audible alerts for incoming Kaamdaar provider jobs',
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        sound: RawResourceAndroidNotificationSound('job_alert'),
        enableVibration: true,
        category: AndroidNotificationCategory.message,
        visibility: NotificationVisibility.public,
        autoCancel: true,
        timeoutAfter: 40000,
      ),
    ),
    payload: bookingId,
  );
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  if (Firebase.apps.isEmpty) {
    await Firebase.initializeApp();
  }
  final bookingId = message.data['bookingId']?.toString() ?? '';
  if (bookingId.isEmpty) return;
  if (message.data['type'] == 'job_offer_cancelled') {
    await _localNotifications.cancel(_notificationId(bookingId));
    return;
  }
  if (message.data['type'] == 'job_offer') {
    await _showBackgroundOffer(message);
  }
}

/// Registers each Provider device and handles offer/cancel pushes in foreground
/// and background. A data-only push lets the app remove the exact local alert
/// as soon as another Pro wins the atomic booking claim.
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

    await _prepareLocalNotifications();
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
    _messageSubscription = FirebaseMessaging.onMessage.listen((message) async {
      final bookingId = message.data['bookingId']?.toString() ?? '';
      if (message.data['type'] == 'job_offer_cancelled') {
        if (bookingId.isNotEmpty) {
          await _localNotifications.cancel(_notificationId(bookingId));
          await JobAlertCenter.instance.cancelOffer(bookingId);
        }
      } else if (message.data['type'] == 'job_offer') {
        await JobAlertCenter.instance.checkNow();
      }
    });

    await _openedSubscription?.cancel();
    _openedSubscription = FirebaseMessaging.onMessageOpenedApp.listen((message) {
      if (message.data['type'] == 'job_offer') {
        JobAlertCenter.instance.checkNow();
      }
    });

    final initial = await messaging.getInitialMessage();
    if (initial != null && initial.data['type'] == 'job_offer') {
      unawaited(JobAlertCenter.instance.checkNow());
    }
  }
}
