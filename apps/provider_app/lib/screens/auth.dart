/// Splash → Onboarding → OTP login → Registration / KYC (per the mockup).
library;

import 'dart:async';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'home.dart';

/// Indian mobile: 10 digits, must start 6–9 (a +91 prefix is accepted).
String? validateIndianMobile(String? v) {
  final raw = (v ?? '').replaceAll(RegExp(r'\D'), '');
  if (raw.isEmpty) return 'Mobile number is required';
  final d = raw.startsWith('91') && raw.length == 12
      ? raw.substring(2)
      : tenDigits(raw);
  if (d.length != 10) return 'Enter the 10-digit mobile number';
  if (!RegExp(r'^[6-9]\d{9}$').hasMatch(d)) {
    return 'Indian mobiles start with 6, 7, 8 or 9';
  }
  return null;
}

String tenDigits(String v) {
  final d = v.replaceAll(RegExp(r'\D'), '');
  return d.length > 10 ? d.substring(d.length - 10) : d;
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _decide();
  }

  Future<void> _decide() async {
    await Future.delayed(Duration.zero);
    if (!mounted) return;
    final seen = await Api.onboarded;
    final user = await Api.restoreSession();
    if (!mounted) return;
    Widget next;
    if (!seen) {
      next = const OnboardingScreen();
    } else if (user == null) {
      next = const LoginScreen();
    } else {
      next = const ProviderShell();
    }
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => next));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PColors.greenDark,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Image.asset(
              'assets/kaamdaar-logo-white.png',
              width: 300,
              height: 150,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.high,
              errorBuilder: (_, __, ___) => const Text(
                'KAAMDAAR',
                style: TextStyle(color: Colors.white, fontSize: 38, letterSpacing: 2.2, fontWeight: FontWeight.w900),
              ),
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                  color: Colors.white24, borderRadius: BorderRadius.circular(999)),
              child: const Text('PROVIDER',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      letterSpacing: 1.6,
                      fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 10),
            const Text('HAR KAAM TURANT',
                style: TextStyle(color: PColors.amber, fontSize: 14, letterSpacing: 2, fontWeight: FontWeight.w800)),
            const SizedBox(height: 24),
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            ),
            const Spacer(),
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 0, 20, 22),
              child: Column(
                children: [
                  Text('© Unique IT Solutions. All rights reserved.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white60, fontSize: 10)),
                  SizedBox(height: 5),
                  Text('Made with Love & Care by Unique IT Solutions',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w700)),
                  Text('A Unit of Unique Computers, The Best One',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white54, fontSize: 9)),
                  SizedBox(height: 4),
                  Text('Terms & Privacy',
                      style: TextStyle(color: PColors.amber, fontSize: 9, fontWeight: FontWeight.w700)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _page = PageController();
  int _index = 0;

  static const _slides = [
    (Icons.work_outline, 'Get Service Requests Near You',
        'Customer ke request aapke phone par — jo pehle accept karega, job uski.'),
    (Icons.sync_alt, 'Manage Jobs Easily',
        'Accept, navigate, start OTP, complete — sab kuch ek app me.'),
    (Icons.account_balance_wallet_outlined, 'Secure Payments',
        'Direct payments to your wallet with complete transparency.'),
  ];

  Future<void> _done() async {
    await Api.setOnboarded();
    if (!mounted) return;
    Navigator.of(context)
        .pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _page,
                itemCount: _slides.length,
                onPageChanged: (i) => setState(() => _index = i),
                itemBuilder: (_, i) {
                  final (icon, title, sub) = _slides[i];
                  return Padding(
                    padding: const EdgeInsets.all(30),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(30),
                          decoration: BoxDecoration(
                            color: PColors.green.withValues(alpha: .1),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(icon, size: 64, color: PColors.flame),
                        ),
                        const SizedBox(height: 32),
                        Text(title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                color: PColors.ink)),
                        const SizedBox(height: 12),
                        Text(sub,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                color: Colors.black54, fontSize: 14, height: 1.5)),
                      ],
                    ),
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 28),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(_slides.length, (i) {
                      return AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        height: 7,
                        width: _index == i ? 22 : 7,
                        decoration: BoxDecoration(
                          color: _index == i ? PColors.flame : const Color(0xFFD1D9D6),
                          borderRadius: BorderRadius.circular(99),
                        ),
                      );
                    }),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      TextButton(
                          onPressed: _done,
                          child: const Text('Skip',
                              style: TextStyle(color: Colors.black45))),
                      const Spacer(),
                      SizedBox(
                        width: 150,
                        child: PrimaryBtn(
                          label: _index == _slides.length - 1 ? 'Get Started' : 'Next',
                          icon: Icons.arrow_forward,
                          onPressed: () {
                            if (_index == _slides.length - 1) {
                              _done();
                            } else {
                              _page.nextPage(
                                  duration: const Duration(milliseconds: 280),
                                  curve: Curves.easeOut);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------- login ------------------------------- */

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  final _otpFocus = FocusNode();
  bool _otpSent = false;
  bool _busy = false;
  String? _error;
  String? _hint;

  @override
  void dispose() {
    _phone.dispose();
    _otp.dispose();
    _otpFocus.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    if (validateIndianMobile(_phone.text) != null) {
      setState(() => _error = validateIndianMobile(_phone.text));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final code = await Api.sendOtp(tenDigits(_phone.text));
      if (!mounted) return;
      setState(() {
        _otpSent = true;
        _hint = code.isEmpty ? null : 'Demo OTP: $code';
      });
      _otpFocus.requestFocus();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify() async {
    final code = _otp.text.trim();
    if (code.length < 4) {
      setState(() => _error = 'Enter the OTP sent to your mobile');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final user = await Api.verifyOtp(tenDigits(_phone.text), code);
      final provider = await Api.me(user.phone);
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(
          builder: (_) => provider == null
              ? RegistrationScreen(user: user)
              : const ProviderShell(),
        ),
        (route) => false,
      );
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _busy = false;
        });
      }
    }
  }

  @override
  @override
  Widget build(BuildContext context) {
    final otpMode = _otpSent;
    return Scaffold(
      backgroundColor: const Color(0xFF081A33),
      body: Stack(children: [
        Positioned(top: -95, right: -75, child: _ProviderGlow(color: const Color(0xFFFF7A00).withOpacity(.38), size: 270)),
        Positioned(bottom: 40, left: -100, child: _ProviderGlow(color: const Color(0xFF1D5A9D).withOpacity(.42), size: 280)),
        SafeArea(child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 26, 22, 30),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(width: 48, height: 48, decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFFFFA12B), Color(0xFFFF6B00)]),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [BoxShadow(color: const Color(0xFFFF7A00).withOpacity(.35), blurRadius: 22, offset: const Offset(0, 8))],
              ), child: const Icon(Icons.handyman_rounded, color: Color(0xFF0B2240), size: 27)),
              const SizedBox(width: 12),
              const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('KAAMDAAR', style: TextStyle(color: Colors.white, fontSize: 20, letterSpacing: 1.6, fontWeight: FontWeight.w900)),
                Text('PROFESSIONAL PARTNER', style: TextStyle(color: Color(0xFFFFC36A), fontSize: 9, letterSpacing: 1.6, fontWeight: FontWeight.w800)),
              ]),
              const Spacer(),
              Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8), decoration: BoxDecoration(color: Colors.white.withOpacity(.09), borderRadius: BorderRadius.circular(99), border: Border.all(color: Colors.white.withOpacity(.16))), child: const Row(children: [Icon(Icons.workspace_premium_outlined, color: Color(0xFFFFB14A), size: 14), SizedBox(width: 5), Text('PARTNER', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800, letterSpacing: .8))])),
            ]),
            const SizedBox(height: 50),
            Text(otpMode ? 'One last step.\nYou’re almost in.' : 'Your skills.\nYour schedule.\nMore earnings.', style: const TextStyle(color: Colors.white, fontSize: 33, height: 1.08, fontWeight: FontWeight.w900, letterSpacing: -.7)),
            const SizedBox(height: 12),
            Text(otpMode ? 'Enter the verification code sent to +91 ${_phone.text}' : 'Get nearby service requests, manage every job and grow with Kaamdaar.', style: TextStyle(color: Colors.white.withOpacity(.72), fontSize: 13.5, height: 1.5)),
            const SizedBox(height: 24),
            Row(children: [
              _ProviderPill(icon: Icons.near_me_rounded, label: 'Nearby jobs'),
              const SizedBox(width: 8),
              _ProviderPill(icon: Icons.account_balance_wallet_rounded, label: 'Clear earnings'),
              const SizedBox(width: 8),
              _ProviderPill(icon: Icons.route_rounded, label: 'Easy navigation'),
            ]),
            const SizedBox(height: 30),
            ClipRRect(borderRadius: BorderRadius.circular(28), child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: Container(
                padding: const EdgeInsets.fromLTRB(20, 23, 20, 22),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(.12),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: Colors.white.withOpacity(.24)),
                  gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Colors.white.withOpacity(.19), Colors.white.withOpacity(.07)]),
                ),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(otpMode ? 'Verify your number' : 'Partner login', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 5),
                  Text(otpMode ? 'Secure OTP verification' : 'Login or register to start earning', style: TextStyle(color: Colors.white.withOpacity(.72), fontSize: 12.5)),
                  const SizedBox(height: 22),
                  if (!otpMode) ...[
                    Container(decoration: BoxDecoration(color: Colors.white.withOpacity(.96), borderRadius: BorderRadius.circular(17), border: Border.all(color: _error == null ? Colors.white : const Color(0xFFFF6B6B))), child: Row(children: [
                      Container(padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 17), decoration: const BoxDecoration(border: Border(right: BorderSide(color: Color(0xFFE5E7EB)))), child: const Text('+91', style: TextStyle(color: Color(0xFF0B2240), fontWeight: FontWeight.w900, fontSize: 15))),
                      Expanded(child: TextField(controller: _phone, keyboardType: TextInputType.phone, inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)], style: const TextStyle(color: Color(0xFF0B2240), fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: 1.2), decoration: const InputDecoration(border: InputBorder.none, hintText: '98765 43210', hintStyle: TextStyle(color: Color(0xFF9CA3AF)), fillColor: Colors.transparent, filled: true, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 17)))),
                    ])),
                    const SizedBox(height: 8),
                    Text('Only Indian mobile numbers are accepted.', style: TextStyle(color: Colors.white.withOpacity(.55), fontSize: 10.5)),
                  ] else ...[
                    Container(decoration: BoxDecoration(color: Colors.white.withOpacity(.96), borderRadius: BorderRadius.circular(17)), padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), child: TextField(controller: _otp, focusNode: _otpFocus, keyboardType: TextInputType.number, textAlign: TextAlign.center, maxLength: 6, onChanged: (v) { if (v.trim().length == 6 && !_busy) _verify(); }, style: const TextStyle(color: Color(0xFF0B2240), fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 12), decoration: const InputDecoration(counterText: '', hintText: '••••••', border: InputBorder.none, fillColor: Colors.transparent, filled: true))),
                    if (_hint != null) Padding(padding: const EdgeInsets.only(top: 10), child: Container(padding: const EdgeInsets.all(11), decoration: BoxDecoration(color: const Color(0xFFFFC36A).withOpacity(.16), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFFFC36A).withOpacity(.25))), child: Text(_hint!, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFFFFD18B), fontSize: 12, fontWeight: FontWeight.w800)))),
                  ],
                  if (_error != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text(_error!, style: const TextStyle(color: Color(0xFFFFB4B4), fontSize: 12))),
                  const SizedBox(height: 18),
                  SizedBox(height: 56, child: ElevatedButton(
                    onPressed: _busy ? null : (otpMode ? _verify : _sendOtp),
                    style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFF8A00), foregroundColor: const Color(0xFF0B2240), elevation: 8, shadowColor: const Color(0xFFFF7A00).withOpacity(.35), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)), textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w900)),
                    child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF0B2240))) : Row(mainAxisAlignment: MainAxisAlignment.center, children: [Text(otpMode ? 'Verify & continue' : 'Continue securely'), const SizedBox(width: 9), const Icon(Icons.arrow_forward_rounded, size: 19)]),
                  )),
                  if (otpMode) TextButton(onPressed: _busy ? null : () => setState(() { _otpSent = false; _otp.clear(); _error = null; }), child: const Text('Change mobile number', style: TextStyle(color: Color(0xFFFFC36A), fontWeight: FontWeight.w700))),
                  const SizedBox(height: 8),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.lock_outline, color: Colors.white.withOpacity(.65), size: 13), const SizedBox(width: 6), Text('Your account is protected with OTP verification', style: TextStyle(color: Colors.white.withOpacity(.68), fontSize: 10))]),
                ]),
              ),
            )),
            const SizedBox(height: 23),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.support_agent, color: Colors.white.withOpacity(.65), size: 16), const SizedBox(width: 6), Text('Partner support whenever you need it', style: TextStyle(color: Colors.white.withOpacity(.7), fontSize: 11))]),
            const SizedBox(height: 20),
            Text('By continuing, you agree to Kaamdaar Partner Terms & Privacy Policy', textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withOpacity(.48), fontSize: 10)),
          ]),
        )),
      ]),
    );
  }
}

/* ---------------------------- registration ---------------------------- */

class RegistrationScreen extends StatefulWidget {
  final SessionUser? user;
  const RegistrationScreen({super.key, this.user});

  @override
  State<RegistrationScreen> createState() => _RegistrationScreenState();
}

class _RegistrationScreenState extends State<RegistrationScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _city = TextEditingController(text: 'Jaipur');
  final _area = TextEditingController();
  final _experience = ValueNotifier<String>('1-3 years');
  final Set<String> _services = {};
  List<ServiceItem> _catalog = [];
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _name.dispose();
    _city.dispose();
    _area.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final list = await Api.catalog();
      if (!mounted) return;
      setState(() => _catalog = list);
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_services.isEmpty) {
      setState(() => _error = 'Select at least one service you can provide');
      return;
    }
    final user = widget.user ?? await Api.restoreSession();
    if (user == null) {
      setState(() => _error = 'Session expired, please log in again.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        throw Exception('Provider registration ke liye location permission zaroori hai.');
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('GPS on karein, phir registration complete karein.');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );
      await Api.register({
        'phone': user.phone,
        'name': _name.text.trim(),
        'services': _services.toList(),
        'city': '${_area.text.trim()}, ${_city.text.trim()}',
        'lat': position.latitude,
        'lng': position.longitude,
        'experience': int.tryParse(_experience.value.split('-').first) ?? 1,
      });
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const ProviderShell()), (route) => false);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Create Your Profile')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: PColors.green))
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(18),
                children: [
                  const Text('Basic details to get started',
                      style: TextStyle(color: Colors.black54, fontSize: 12.5)),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Full name'),
                    validator: (v) =>
                        (v ?? '').trim().length < 3 ? 'Enter your full name' : null,
                  ),
                  const SizedBox(height: 12),
                  ValueListenableBuilder<String>(
                    valueListenable: _experience,
                    builder: (context, value, _) => DropdownButtonFormField<String>(
                      initialValue: value,
                      decoration: const InputDecoration(labelText: 'Experience'),
                      items: const ['0-1 years', '1-3 years', '3-5 years', '5+ years']
                          .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                          .toList(),
                      onChanged: (v) => _experience.value = v ?? value,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _area,
                          decoration: const InputDecoration(labelText: 'Area / locality'),
                          validator: (v) =>
                              (v ?? '').trim().isEmpty ? 'Area is required' : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _city,
                          decoration: const InputDecoration(labelText: 'City'),
                          validator: (v) =>
                              (v ?? '').trim().isEmpty ? 'City is required' : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                      'Jaipur mein pehle 3 km aur zaroorat par 5 km tak ke customer requests milenge.',
                      style: TextStyle(fontSize: 11, color: Colors.black45)),
                  const SizedBox(height: 18),
                  const Text('Select service categories',
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  const SizedBox(height: 8),
                  if (_catalog.isEmpty)
                    const CardBox(
                        child: Text('No services in the catalogue yet. Ask the admin to add services.',
                            style: TextStyle(color: Colors.black54, fontSize: 12.5)))
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _catalog.take(24).map((s) {
                        final picked = _services.contains(s.id);
                        return FilterChip(
                          label: Text(s.name, style: const TextStyle(fontSize: 12)),
                          selected: picked,
                          selectedColor: PColors.flame.withValues(alpha: .18),
                          checkmarkColor: PColors.flame,
                          onSelected: (on) => setState(() {
                            if (on) {
                              _services.add(s.id);
                            } else {
                              _services.remove(s.id);
                            }
                          }),
                        );
                      }).toList(),
                    ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: PColors.red, fontSize: 13)),
                  ],
                  const SizedBox(height: 20),
                  PrimaryBtn(label: 'Continue to KYC', busy: _busy, onPressed: _submit),
                  const SizedBox(height: 10),
                  const Text(
                    'Documents (Aadhaar / PAN / photo) admin dashboard se verify hote hain — approval ke baad aapko live requests milna shuru ho jayenge.',
                    style: TextStyle(fontSize: 11, color: Colors.black45),
                  ),
                ],
              ),
            ),
    );
  }
}

class _ProviderGlow extends StatelessWidget {
 final Color color; final double size;
 const _ProviderGlow({required this.color, required this.size});
 @override Widget build(BuildContext context) => Container(width:size,height:size,decoration:BoxDecoration(shape:BoxShape.circle,boxShadow:[BoxShadow(color:color,blurRadius:90,spreadRadius:35)]));
}
class _ProviderPill extends StatelessWidget {
 final IconData icon; final String label;
 const _ProviderPill({required this.icon,required this.label});
 @override Widget build(BuildContext context) => Expanded(child:Container(
  padding:const EdgeInsets.symmetric(horizontal:7,vertical:10),
  decoration:BoxDecoration(color:Colors.white.withOpacity(.09),borderRadius:BorderRadius.circular(13),border:Border.all(color:Colors.white.withOpacity(.14))),
  child:Row(mainAxisAlignment:MainAxisAlignment.center,children:[Icon(icon,color:const Color(0xFFFFB14A),size:14),const SizedBox(width:5),Flexible(child:Text(label,maxLines:1,overflow:TextOverflow.ellipsis,style:const TextStyle(color:Colors.white,fontSize:9,fontWeight:FontWeight.w700)))]),
 ));
}
