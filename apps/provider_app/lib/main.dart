import 'package:flutter/material.dart';

import 'core/job_alerts.dart';
import 'core/theme.dart';
import 'screens/auth.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KaamdaarProviderApp());
}

class KaamdaarProviderApp extends StatelessWidget {
  const KaamdaarProviderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kaamdaar Provider',
      debugShowCheckedModeBanner: false,
      // A job offer is pushed through this navigator so it can appear over any
      // screen the Pro is on.
      navigatorKey: jobAlertNavigatorKey,
      theme: providerTheme(),
      home: const SplashScreen(),
    );
  }
}
