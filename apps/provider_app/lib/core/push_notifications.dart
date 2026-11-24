import 'dart:async';
import 'dart:convert';
import 'dart:ui';

import 'package:flutter/widgets.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';
import 'job_alerts.dart';
import 'models.dart';

const String _jobChannelId = 'kaamdaar_job_alerts_v4';
const String _jobChannelName = 'Kaamdaar new job requests';
final FlutterLocalNotificationsPlugin _localNotifications =
    FlutterLocalNotificationsPlugin();

int _notificationId(String bookingId) => bookingId.codeUnits.fold<int>(
      0,
      (value, unit) => (value * 31 + unit) & 0x7fffffff,
    );

void _handleLocalNotificationResponse(NotificationResponse response) {
  final bookingId = response.payload ?? '';
  final action = response.actionId;
  if (action != null && bookingId.isNotEmpty) {
    unawaited(JobAlertCenter.instance.handleNotificationAction(action, bookingId));
  } else {
    unawaited(JobAlertCenter.instance.checkNow());
  }
}

Future<void> _prepareLocalNotifications() async {
  await _localNotifications.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
    ),
    onDidReceiveNotificationResponse: _handleLocalNotificationResponse,
    onDidReceiveBackgroundNotificationResponse: providerNotificationActionBackground,
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
      enableVibration: true,
    ),
  );
}

Future<void> _showCustomerCancellation(RemoteMessage message) async {
  final bookingId = message.data['bookingId']?.toString() ?? '';
  if (bookingId.isEmpty) return;
  await _prepareLocalNotifications();
  await _localNotifications.show(
    _notificationId(bookingId) + 1,
    message.data['title']?.toString() ?? 'Customer cancelled the booking',
    message.data['body']?.toString() ?? 'Please refresh your Jobs list.',
    const NotificationDetails(
      android: AndroidNotificationDetails(
        _jobChannelId,
        _jobChannelName,
        channelDescription: 'Kaamdaar booking updates',
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        enableVibration: true,
        category: AndroidNotificationCategory.message,
        visibility: NotificationVisibility.public,
        autoCancel: true,
      ),
    ),
    payload: bookingId,
  );
}

@pragma('vm:entry-point')
Future<void> providerNotificationActionBackground(NotificationResponse response) async {
  WidgetsFlutterBinding.ensureInitialized();
  DartPluginRegistrant.ensureInitialized();
  if (response.actionId != 'CANCEL') return;
  final bookingId = response.payload ?? '';
  if (bookingId.isEmpty) return;
  try {
    final user = await Api.restoreSession();
    if (user == null) return;
    final provider = await Api.me(user.phone);
    if (provider == null) return;
    final offers = await Api.inbox(provider.id);
    BookingItem? booking;
    for (final row in offers) {
      if (row.id == bookingId &&
          row.status == 'dispatched' &&
          row.notifiedIds.contains(provider.id)) {
        booking = row;
        break;
      }
    }
    if (booking == null) return;
    await Api.decline(booking, provider.id);
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('kaamdaar.provider.missed');
    final history = raw == null
        ? <Map<String, dynamic>>[]
        : (jsonDecode(raw) as List).whereType<Map<String, dynamic>>().toList();
    history.removeWhere((row) => row['id'] == bookingId);
    history.add({
      'id': bookingId,
      'service': booking.serviceName,
      'reason': 'declined',
      'at': DateTime.now().millisecondsSinceEpoch,
    });
    await prefs.setString('kaamdaar.provider.missed', jsonEncode(history));
    final handled = prefs.getStringList('kaamdaar.provider.handled') ?? <String>[];
    if (!handled.contains(bookingId)) handled.add(bookingId);
    await prefs.setStringList('kaamdaar.provider.handled', handled);
  } catch (_) {
    // The next Provider inbox refresh remains the fallback if the OS kills
    // this background action before the request completes.
  }
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
        enableVibration: true,
        category: AndroidNotificationCategory.message,
        visibility: NotificationVisibility.public,
        autoCancel: true,
        timeoutAfter: 40000,
        actions: <AndroidNotificationAction>[
          AndroidNotificationAction(
            'ACCEPT',
            'Accept',
            showsUserInterface: true,
            cancelNotification: true,
          ),
          AndroidNotificationAction(
            'CANCEL',
            'Cancel',
            showsUserInterface: false,
            cancelNotification: true,
          ),
        ],
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
  if (message.data['type'] == 'booking_cancelled_by_customer') {
    await _localNotifications.cancel(_notificationId(bookingId));
    await _showCustomerCancellation(message);
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

    await _prepareLocalNotifications();
    // Android can launch a terminated app directly from a notification action.
    // Recover that action explicitly so Accept still opens the requested job.
    final launchDetails = await _localNotifications.getNotificationAppLaunchDetails();
    final launchResponse = launchDetails?.notificationResponse;
    if (launchDetails?.didNotificationLaunchApp == true && launchResponse != null) {
      _handleLocalNotificationResponse(launchResponse);
    }
    final messaging = FirebaseMessaging.instance;
    await messaging.requestPermission(alert: true, badge: true, sound: true, announcement: false, carPlay: false, criticalAlert: false, provisional: false);
    await messaging.setAutoInitEnabled(true);
    await messaging.setForegroundNotificationPresentationOptions(alert: true, badge: true, sound: true);

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
      } else if (message.data['type'] == 'booking_cancelled_by_customer') {
        if (bookingId.isNotEmpty) {
          await _localNotifications.cancel(_notificationId(bookingId));
          await _showCustomerCancellation(message);
          await JobAlertCenter.instance.cancelOffer(bookingId);
        }
      } else if (message.data['type'] == 'job_offer') {
        // Show an audible OS notification even while the Provider app is open;
        // the in-app offer screen separately starts the repeating siren.
        await _showBackgroundOffer(message);
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
    // Mark initialized only after all setup steps succeed. If Android denies
    // a permission or Firebase temporarily fails, app-resume can retry setup.
    _registeredProviderId = providerId;
  }
}
