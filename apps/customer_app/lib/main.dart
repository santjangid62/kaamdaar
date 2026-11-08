import 'package:flutter/material.dart';

import 'core/theme.dart';
import 'screens/auth.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KaamdaarApp());
}

class KaamdaarApp extends StatelessWidget {
  const KaamdaarApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Kaamdaar',
      debugShowCheckedModeBanner: false,
      theme: kamTheme(),
      home: const SplashScreen(),
    );
  }
}