import 'package:flutter/material.dart';

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
      theme: providerTheme(),
      home: const SplashScreen(),
    );
  }
}
