import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import 'core/job_alerts.dart';
import 'core/push_notifications.dart';
import 'core/theme.dart';
import 'screens/auth.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Android configuration is supplied by android/app/google-services.json.
  // iOS Firebase bootstrap is enabled after its plist and APNs key are added.
  if (defaultTargetPlatform == TargetPlatform.android) {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
  }
  runApp(const KaamdaarProviderApp());
}

class KaamdaarProviderApp extends StatelessWidget {
  const KaamdaarProviderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kaamdaar Provider',
      debugShowCheckedModeBanner: false,
      navigatorKey: jobAlertNavigatorKey,
      theme: providerTheme(),
      home: const SplashScreen(),
    );
  }
}
