import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:webview_flutter/webview_flutter.dart';

const String adminUrl = String.fromEnvironment(
  'ADMIN_URL',
  defaultValue: 'https://kaamdaar-git-feat-phonepe-payment-gateway-unique-it-team.vercel.app',
);
const navy = Color(0xFF071A31);
const teal = Color(0xFF0E9F6E);
const orange = Color(0xFFFF8A1F);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const KaamdaarSuperAdminApp());
}

class KaamdaarSuperAdminApp extends StatelessWidget {
  const KaamdaarSuperAdminApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Kaamdaar Super Admin',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          useMaterial3: true,
          colorScheme: ColorScheme.fromSeed(seedColor: teal),
          scaffoldBackgroundColor: navy,
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
          ),
        ),
        home: const AdminLocationGate(),
      );
}

class AdminLocationGate extends StatefulWidget {
  const AdminLocationGate({super.key});
  @override
  State<AdminLocationGate> createState() => _AdminLocationGateState();
}

class _AdminLocationGateState extends State<AdminLocationGate> with WidgetsBindingObserver {
  bool checking = true;
  bool busy = false;
  String message = 'Checking device location permission…';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _verify(requestPermission: true);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !checking) {
      _verify(requestPermission: false);
    }
  }

  Future<void> _verify({required bool requestPermission}) async {
    if (busy || !mounted) return;
    busy = true;
    setState(() { checking = true; message = 'Checking GPS and location access…'; });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('Please turn on Location Services / GPS and retry.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied && requestPermission) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever || permission == LocationPermission.unableToDetermine) {
        throw Exception(permission == LocationPermission.deniedForever
            ? 'Location permission is blocked. Allow it in Android App Settings.'
            : 'Location permission is required to continue.');
      }
      await Geolocator.getCurrentPosition(locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20),
      ));
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const AdminSplashScreen()));
    } catch (e) {
      if (mounted) setState(() => message = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      busy = false;
      if (mounted) setState(() => checking = false);
    }
  }

  Future<void> _openSettings() async {
    await Geolocator.openAppSettings();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(child: Center(child: SingleChildScrollView(
          padding: const EdgeInsets.all(26),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const _BrandHeader(),
            const SizedBox(height: 38),
            const Icon(Icons.location_on_rounded, color: orange, size: 64),
            const SizedBox(height: 18),
            const Text('Allow your location', textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 27, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            Text('Kaamdaar verifies this device location before opening the Super Admin workspace.',
              textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withOpacity(.72), height: 1.5)),
            const SizedBox(height: 24),
            Text(message, textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFFFFB4A9), fontSize: 14, height: 1.45)),
            const SizedBox(height: 22),
            SizedBox(width: double.infinity, height: 54, child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: orange, foregroundColor: navy),
              onPressed: checking ? null : () => _verify(requestPermission: true),
              icon: checking ? const SizedBox(width: 18,height: 18,child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.my_location),
              label: Text(checking ? 'VERIFYING…' : 'ALLOW & CONTINUE', style: const TextStyle(fontWeight: FontWeight.w900)),
            )),
            TextButton(onPressed: _openSettings, child: const Text('Open app settings', style: TextStyle(color: Colors.white70))),
          ]),
        ))),
      );
}

class AdminSplashScreen extends StatefulWidget {
  const AdminSplashScreen({super.key});
  @override
  State<AdminSplashScreen> createState() => _AdminSplashScreenState();
}
class _AdminSplashScreenState extends State<AdminSplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 1600), () {
      if (mounted) Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const AdminLoginScreen()));
    });
  }
  @override
  Widget build(BuildContext context) => const Scaffold(
    body: SafeArea(child: Column(children: [
      Spacer(), _BrandHeader(), SizedBox(height: 22),
      Text('SUPER ADMIN', style: TextStyle(color: Color(0xFFFFB15C), letterSpacing: 3, fontWeight: FontWeight.w900)),
      SizedBox(height: 24), CircularProgressIndicator(color: orange), Spacer(),
      Text('Unique IT Solutions · A Unit of Unique Computers', style: TextStyle(color: Colors.white54, fontSize: 10)),
      SizedBox(height: 24),
    ])),
  );
}

class _BrandHeader extends StatelessWidget {
  const _BrandHeader();
  @override
  Widget build(BuildContext context) => Column(children: [
    Container(width: 78,height: 78,padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white.withOpacity(.10),borderRadius: BorderRadius.circular(24),border: Border.all(color: Colors.white24)),
      child: const Icon(Icons.home_repair_service_rounded,color: orange,size: 45)),
    const SizedBox(height: 14),
    const Text('KAAMDAAR',style: TextStyle(color: Colors.white,fontSize: 25,fontWeight: FontWeight.w900,letterSpacing: 2.4)),
    const SizedBox(height: 4),
    const Text('SUPER ADMIN',style: TextStyle(color: Color(0xFF69D5B0),fontSize: 11,fontWeight: FontWeight.w900,letterSpacing: 2.6)),
  ]);
}

class AdminLoginScreen extends StatefulWidget {
  const AdminLoginScreen({super.key});
  @override
  State<AdminLoginScreen> createState() => _AdminLoginScreenState();
}
class _AdminLoginScreenState extends State<AdminLoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool busy = false;
  bool obscure = true;
  String? error;

  @override
  void dispose() { email.dispose(); password.dispose(); super.dispose(); }

  Future<void> _login() async {
    final mail = email.text.trim();
    if (!RegExp(r'^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$').hasMatch(mail)) {
      setState(() => error = 'Enter a valid email address.'); return;
    }
    if (password.text.isEmpty) { setState(() => error = 'Password is required.'); return; }
    setState(() { busy = true; error = null; });
    try {
      final base = Uri.parse(adminUrl);
      final endpoint = base.resolve('/api/super-admin/login');
      final response = await http.post(endpoint,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': mail, 'password': password.text}),
      ).timeout(const Duration(seconds: 25));
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (response.statusCode != 200) {
        throw Exception(data['error']?.toString() ?? 'Login failed. Please try again.');
      }
      final setCookie = response.headers['set-cookie'];
      if (setCookie == null || !setCookie.contains('=')) {
        throw Exception('Secure login session was not returned by the server.');
      }
      final pair = setCookie.split(';').first;
      final split = pair.indexOf('=');
      final cookieName = pair.substring(0, split);
      final cookieValue = pair.substring(split + 1);
      final controller = WebViewController()..setJavaScriptMode(JavaScriptMode.unrestricted);
      final cookieManager = WebViewCookieManager();
      await cookieManager.setCookie(WebViewCookie(name: cookieName, value: cookieValue, domain: base.host, path: '/'));
      if (!mounted) return;
      Navigator.of(context).pushReplacement(MaterialPageRoute(
        builder: (_) => AdminDashboardPage(controller: controller),
      ));
    } catch (e) {
      if (mounted) setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(child: Center(child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 460), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const _BrandHeader(), const SizedBox(height: 34),
        Container(padding: const EdgeInsets.all(22),decoration: BoxDecoration(color: const Color(0xFF20364F),borderRadius: BorderRadius.circular(24),border: Border.all(color: Colors.white24)),child: Column(crossAxisAlignment: CrossAxisAlignment.stretch,children: [
          const Text('Super Admin Login',style: TextStyle(color: Colors.white,fontSize: 25,fontWeight: FontWeight.w900)),
          const SizedBox(height: 8), Text('Sign in to manage the complete Kaamdaar platform.',style: TextStyle(color: Colors.white.withOpacity(.68),height: 1.45)),
          const SizedBox(height: 22), const Text('EMAIL ADDRESS',style: TextStyle(color: Color(0xFF69D5B0),fontSize: 11,fontWeight: FontWeight.w900,letterSpacing: 1.4)),
          const SizedBox(height: 8), TextField(controller: email,keyboardType: TextInputType.emailAddress,autofillHints: const [AutofillHints.username],style: const TextStyle(color: navy,fontWeight: FontWeight.w700),decoration: const InputDecoration(hintText: 'superadmin@kaamdaar.com',prefixIcon: Icon(Icons.email_outlined))),
          const SizedBox(height: 18), const Text('PASSWORD',style: TextStyle(color: Color(0xFF69D5B0),fontSize: 11,fontWeight: FontWeight.w900,letterSpacing: 1.4)),
          const SizedBox(height: 8), TextField(controller: password,obscureText: obscure,autofillHints: const [AutofillHints.password],style: const TextStyle(color: navy,fontWeight: FontWeight.w700),decoration: InputDecoration(hintText: 'Enter your password',prefixIcon: const Icon(Icons.lock_outline),suffixIcon: IconButton(onPressed: () => setState(() => obscure = !obscure),icon: Icon(obscure ? Icons.visibility : Icons.visibility_off)))),
          if (error != null) ...[const SizedBox(height: 14),Text(error!,style: const TextStyle(color: Color(0xFFFFB4A9),fontSize: 13))],
          const SizedBox(height: 22),SizedBox(height: 54,child: FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: teal,foregroundColor: Colors.white),onPressed: busy ? null : _login,icon: busy ? const SizedBox(width: 18,height: 18,child: CircularProgressIndicator(strokeWidth: 2,color: Colors.white)) : const Icon(Icons.login),label: Text(busy ? 'VALIDATING…' : 'LOGIN TO DASHBOARD',style: const TextStyle(fontWeight: FontWeight.w900)))),
        ])),
        const SizedBox(height: 18),const Text('Secure authentication · Authorized Super Admin only',textAlign: TextAlign.center,style: TextStyle(color: Colors.white54,fontSize: 11)),
      ])),
    ))),
  );
}

class AdminDashboardPage extends StatefulWidget {
  final WebViewController controller;
  const AdminDashboardPage({super.key, required this.controller});
  @override
  State<AdminDashboardPage> createState() => _AdminDashboardPageState();
}
class _AdminDashboardPageState extends State<AdminDashboardPage> {
  bool loading = true;
  bool failed = false;
  @override
  void initState() {
    super.initState();
    widget.controller
      ..setBackgroundColor(const Color(0xFFF3F6FB))
      ..setNavigationDelegate(NavigationDelegate(
        onPageStarted: (_) { if (mounted) setState(() { loading = true; failed = false; }); },
        onPageFinished: (_) { if (mounted) setState(() => loading = false); },
        onWebResourceError: (e) { if (e.isForMainFrame == true && mounted) setState(() { loading = false; failed = true; }); },
      ))
      ..loadRequest(Uri.parse('${adminUrl.replaceFirst(RegExp(r'/+$'), '')}/super-admin'));
  }
  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, result) async {
      if (!didPop && await widget.controller.canGoBack()) { await widget.controller.goBack(); }
      else if (!didPop && mounted) { SystemNavigator.pop(); }
    },
    child: Scaffold(body: SafeArea(child: Stack(children: [
      WebViewWidget(controller: widget.controller),
      if (loading) const Align(alignment: Alignment.topCenter,child: LinearProgressIndicator(minHeight: 2)),
      if (failed) Center(child: Padding(padding: const EdgeInsets.all(24),child: Column(mainAxisSize: MainAxisSize.min,children: [
        const Icon(Icons.wifi_off,size: 48),const SizedBox(height: 12),
        const Text('Unable to load Super Admin Dashboard',textAlign: TextAlign.center,style: TextStyle(fontSize: 18,fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),const Text('Check your internet connection and retry.'),
        const SizedBox(height: 16),FilledButton.icon(onPressed: () { setState(() { failed = false; loading = true; }); widget.controller.reload(); },icon: const Icon(Icons.refresh),label: const Text('Retry')),
      ]))),
    ]))),
  );
}
