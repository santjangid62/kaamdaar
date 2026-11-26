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

class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key});

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  bool _busy = false;

  Future<void> _continue() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      final user = await Api.restoreSession();
      if (!mounted) return;
      final Widget next = user == null
          ? const LoginScreen()
          : const ProviderShell();
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => next),
      );
    } catch (_) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF071A31),
      body: Stack(
        children: [
          Positioned(
            top: -110,
            right: -100,
            child: _ProviderGlow(
              color: const Color(0xFF0E9F6E).withOpacity(.30),
            ),
          ),
          Positioned(
            bottom: -90,
            left: -100,
            child: _ProviderGlow(
              color: const Color(0xFFFF7A00).withOpacity(.18),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(24, 28, 24, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 62,
                        height: 62,
                        padding: const EdgeInsets.all(9),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(.10),
                          borderRadius: BorderRadius.circular(19),
                          border: Border.all(
                            color: Colors.white.withOpacity(.18),
                          ),
                        ),
                        child: Image.asset(
                          'assets/kaamdaar-logo-white.png',
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.handyman_rounded,
                            color: Color(0xFF69D5B0),
                            size: 34,
                          ),
                        ),
                      ),
                      const SizedBox(width: 13),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'KAAMDAAR',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.8,
                            ),
                          ),
                          SizedBox(height: 3),
                          Text(
                            'PARTNER NETWORK',
                            style: TextStyle(
                              color: Color(0xFF69D5B0),
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.8,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0E9F6E).withOpacity(.15),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: const Color(0xFF69D5B0).withOpacity(.28),
                      ),
                    ),
                    child: const Row(
                      children: [
                        Icon(
                          Icons.trending_up_rounded,
                          color: Color(0xFF69D5B0),
                          size: 34,
                        ),
                        SizedBox(width: 14),
                        Expanded(
                          child: Text(
                            'Grow your work.\nEarn on your schedule.',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 25,
                              height: 1.18,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'Your skills deserve more opportunities.',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Join trusted local professionals serving their neighbourhood with Kaamdaar. Receive service requests, manage jobs and grow your earnings.',
                    style: TextStyle(
                      color: Colors.white.withOpacity(.68),
                      fontSize: 15,
                      height: 1.6,
                    ),
                  ),
                  const SizedBox(height: 24),
                  _landingFeature(
                    Icons.notifications_active_outlined,
                    'Get service requests near you',
                  ),
                  _landingFeature(
                    Icons.route_outlined,
                    'Manage jobs and navigate to customers',
                  ),
                  _landingFeature(
                    Icons.account_balance_wallet_outlined,
                    'Track your earnings transparently',
                  ),
                  const Spacer(),
                  PrimaryBtn(
                    label: 'Get Started',
                    icon: Icons.arrow_forward_rounded,
                    busy: _busy,
                    color: PColors.green,
                    onPressed: _continue,
                  ),
                  const SizedBox(height: 15),
                  Text(
                    '© Unique IT Solutions  •  A Unit of Unique Computers, The Best One',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withOpacity(.42),
                      fontSize: 10,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Terms & Privacy',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFF69D5B0),
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _landingFeature(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: const Color(0xFF69D5B0).withOpacity(.12),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, color: const Color(0xFF69D5B0), size: 19),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                color: Colors.white.withOpacity(.82),
                fontSize: 13,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
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
      backgroundColor: const Color(0xFF071A31),
      body: Stack(children: [
        Positioned(top: -100, right: -90, child: _ProviderGlow(color: const Color(0xFF0E9F6E).withOpacity(.30))),
        Positioned(bottom: 30, left: -100, child: _ProviderGlow(color: const Color(0xFFFF7A00).withOpacity(.20))),
        SafeArea(child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 25, 22, 24),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Container(width: 54, height: 54, padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: Colors.white.withOpacity(.10), borderRadius: BorderRadius.circular(17), border: Border.all(color: Colors.white.withOpacity(.18))),
                child: Image.asset('assets/kaamdaar-logo-white.png', fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(Icons.handyman, color: Color(0xFFFF7A00), size: 32))),
              const SizedBox(width: 12),
              const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('KAAMDAAR', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 1.8)),
                Text('PARTNER NETWORK', style: TextStyle(color: Color(0xFF69D5B0), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1.8)),
              ]),
            ]),
            const SizedBox(height: 42),
            Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: const Color(0xFF0E9F6E).withOpacity(.15), borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFF69D5B0).withOpacity(.24))),
              child: const Row(children: [
                Icon(Icons.trending_up_rounded, color: Color(0xFF69D5B0), size: 25),
                SizedBox(width: 10),
                Expanded(child: Text('Grow your work.\nEarn on your schedule.', style: TextStyle(color: Colors.white, fontSize: 21, height: 1.2, fontWeight: FontWeight.w900))),
              ])),
            const SizedBox(height: 12),
            Text('Join trusted local professionals serving their neighbourhood with Kaamdaar.', style: TextStyle(color: Colors.white.withOpacity(.65), fontSize: 13, height: 1.5)),
            const SizedBox(height: 25),
            ClipRRect(borderRadius: BorderRadius.circular(26), child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
              child: Container(padding: const EdgeInsets.fromLTRB(20, 22, 20, 20),
                decoration: BoxDecoration(color: Colors.white.withOpacity(.10), borderRadius: BorderRadius.circular(26), border: Border.all(color: Colors.white.withOpacity(.20))),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(_otpSent ? 'Verify your number' : 'Partner login', style: const TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 6),
                  Text(_otpSent ? 'Enter the OTP sent to +91 ${_phone.text}' : 'Login or register to start receiving service requests.', style: TextStyle(color: Colors.white.withOpacity(.65), fontSize: 12.5)),
                  const SizedBox(height: 20),
                  if (!_otpSent) ...[
                    const Text('REGISTERED MOBILE NUMBER', style: TextStyle(color: Color(0xFF69D5B0), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.2)),
                    const SizedBox(height: 9),
                    Container(decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(15)),
                      child: TextField(controller: _phone, keyboardType: TextInputType.phone,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
                        style: const TextStyle(color: Color(0xFF0B2240), fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: 1.1),
                        decoration: const InputDecoration(prefixText: '+91  ', hintText: '98765 43210', border: InputBorder.none, filled: false, contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 17)))),
                    const SizedBox(height: 8),
                    Text('Only Indian mobile numbers are accepted.', style: TextStyle(color: Colors.white.withOpacity(.48), fontSize: 10.5)),
                    const SizedBox(height: 18),
                    PrimaryBtn(label: 'Send OTP', busy: _busy, onPressed: _sendOtp, color: PColors.green),
                  ] else ...[
                    TextField(controller: _otp, focusNode: _otpFocus, keyboardType: TextInputType.number, textAlign: TextAlign.center, maxLength: 6,
                      onChanged: (v) { if (v.trim().length == 6 && !_busy) _verify(); },
                      style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w900, letterSpacing: 12),
                      decoration: InputDecoration(counterText: '', hintText: '••••••', hintStyle: TextStyle(color: Colors.white.withOpacity(.25)), enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(15), borderSide: BorderSide(color: Colors.white.withOpacity(.25))), focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(15), borderSide: const BorderSide(color: Color(0xFF69D5B0), width: 1.5)), filled: false)),
                    if (_hint != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_hint!, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFFFFD38A), fontSize: 12, fontWeight: FontWeight.w700))),
                    const SizedBox(height: 16),
                    PrimaryBtn(label: 'Verify & Continue', busy: _busy, onPressed: _verify, color: PColors.green),
                    TextButton(onPressed: _busy ? null : () => setState(() { _otpSent = false; _otp.clear(); }), child: const Text('Change mobile number', style: TextStyle(color: Color(0xFF9DDCC8)))),
                  ],
                  if (_error != null) Padding(padding: const EdgeInsets.only(top: 12), child: Text(_error!, textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFFFF9B9B), fontSize: 12))),
                  const SizedBox(height: 14),
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.shield_outlined, color: Colors.white.withOpacity(.48), size: 14), const SizedBox(width: 6),
                    Text('Secure OTP authentication', style: TextStyle(color: Colors.white.withOpacity(.48), fontSize: 10.5)),
                  ]),
                ]),
              ),
            )),
            const SizedBox(height: 24),
            Text('By continuing you agree to our Terms & Privacy Policy.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withOpacity(.45), fontSize: 11)),
            const SizedBox(height: 8),
            Text('© Unique IT Solutions • Kaamdaar Partner', textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withOpacity(.32), fontSize: 10)),
          ]),
        )),
      ]),
    );
  }

}

class _ProviderGlow extends StatelessWidget {
  final Color color;
  const _ProviderGlow({required this.color});
  @override
  Widget build(BuildContext context) => Container(width: 270, height: 270,
    decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [BoxShadow(color: color, blurRadius: 95, spreadRadius: 28)]));
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
