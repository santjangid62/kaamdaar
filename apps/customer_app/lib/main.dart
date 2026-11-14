import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';

import 'core/theme.dart';
import 'screens/auth.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Android configuration is supplied by android/app/google-services.json.
  // iOS Firebase bootstrap is enabled after its plist is added.
  if (defaultTargetPlatform == TargetPlatform.android) {
    await Firebase.initializeApp();
  }
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
