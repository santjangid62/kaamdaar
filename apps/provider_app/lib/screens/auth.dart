/// Splash → Onboarding → OTP login → Registration / KYC (per the mockup).
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

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
    await Future.delayed(const Duration(milliseconds: 1400));
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
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                  color: Colors.white, borderRadius: BorderRadius.circular(22)),
              child: const Icon(Icons.handyman, color: PColors.green, size: 46),
            ),
            const SizedBox(height: 18),
            const Text('Kaamdaar',
                style: TextStyle(
                    color: Colors.white, fontSize: 30, fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                  color: Colors.white24, borderRadius: BorderRadius.circular(999)),
              child: const Text('PROVIDER',
                  style: TextStyle(
                      color: Colors.white,
                      fontSize: 10.5,
                      letterSpacing: 1.4,
                      fontWeight: FontWeight.w800)),
            ),
            const SizedBox(height: 8),
            const Text('Har Kaam Turant',
                style: TextStyle(color: PColors.amber, fontSize: 13)),
            const SizedBox(height: 28),
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
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
                          child: Icon(icon, size: 64, color: PColors.green),
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
                          color: _index == i ? PColors.green : const Color(0xFFD1D9D6),
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
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 40, 24, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: const BoxDecoration(
                      color: PColors.green, shape: BoxShape.circle),
                  child: const Icon(Icons.handyman, color: Colors.white, size: 36),
                ),
              ),
              const SizedBox(height: 16),
              const Center(
                child: Text('Kaamdaar Provider',
                    style: TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w900, color: PColors.ink)),
              ),
              const SizedBox(height: 6),
              Center(
                child: Text(
                  _otpSent ? 'Enter the OTP sent to +91 ${_phone.text}' : 'Login / Register to start earning',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.black54, fontSize: 13),
                ),
              ),
              const SizedBox(height: 30),
              if (!_otpSent) ...[
                TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  decoration: const InputDecoration(
                    labelText: 'Mobile number',
                    prefixText: '+91  ',
                    hintText: '98765 43210',
                  ),
                ),
                const SizedBox(height: 8),
                const Text('Only Indian mobile numbers are accepted.',
                    style: TextStyle(fontSize: 11, color: Colors.black45)),
                const SizedBox(height: 18),
                PrimaryBtn(label: 'Continue', busy: _busy, onPressed: _sendOtp),
              ] else ...[
                TextField(
                  controller: _otp,
                  focusNode: _otpFocus,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  maxLength: 6,
                  onChanged: (v) {
                    // auto-verify as soon as the full code is typed
                    if (v.trim().length == 6 && !_busy) _verify();
                  },
                  style: const TextStyle(
                      fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 12),
                  decoration: const InputDecoration(counterText: '', hintText: '••••••'),
                ),
                const SizedBox(height: 8),
                if (_hint != null)
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                        color: PColors.amber.withValues(alpha: .18),
                        borderRadius: BorderRadius.circular(10)),
                    child: Text(_hint!,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                const SizedBox(height: 14),
                PrimaryBtn(label: 'Verify & Continue', busy: _busy, onPressed: _verify),
                TextButton(
                  onPressed: _busy ? null : () => setState(() { _otpSent = false; _otp.clear(); }),
                  child: const Text('Change number'),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: PColors.red, fontSize: 13)),
              ],
              const SizedBox(height: 26),
              const Text('By continuing you agree to our Terms & Privacy Policy.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: Colors.black38)),
            ],
          ),
        ),
      ),
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
      await Api.register({
        'phone': user.phone,
        'name': _name.text.trim(),
        'services': _services.toList(),
        'city': '${_area.text.trim()}, ${_city.text.trim()}',
        'lat': 26.9124,
        'lng': 75.7873,
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
                      'Dispatch radius 3 km — aapke area ke aas-paas ke customer requests milenge.',
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
                          selectedColor: PColors.green.withValues(alpha: .18),
                          checkmarkColor: PColors.green,
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
