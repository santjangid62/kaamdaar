/// Splash → Onboarding → Login → OTP (mirrors the web flow).
library;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/theme.dart';
import 'home.dart';
import 'setup.dart';

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
          : (user.firstName.trim().isEmpty
              ? ProfileSetupScreen(user: user)
              : const HomeScreen(homeTab: 0));
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
            top: -100,
            right: -90,
            child: _GlowOrb(
              color: const Color(0xFFFF7A00).withOpacity(.27),
              size: 270,
            ),
          ),
          Positioned(
            bottom: -100,
            left: -100,
            child: _GlowOrb(
              color: const Color(0xFF2476B8).withOpacity(.25),
              size: 280,
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(22, 26, 22, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 58,
                        height: 58,
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(.10),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: Colors.white.withOpacity(.18),
                          ),
                        ),
                        child: Image.asset(
                          'assets/kaamdaar-logo-white.png',
                          fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Icon(
                            Icons.home_repair_service_rounded,
                            color: Color(0xFFFF7A00),
                            size: 32,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
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
                            'HAR KAAM TURANT',
                            style: TextStyle(
                              color: Color(0xFFFFB15C),
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.8,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.all(21),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(.09),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: Colors.white.withOpacity(.17),
                      ),
                    ),
                    child: const Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.home_repair_service_rounded,
                          color: Color(0xFFFFB15C),
                          size: 34,
                        ),
                        SizedBox(height: 18),
                        Text(
                          'Your home.\nOur responsibility.',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 29,
                            height: 1.12,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 10),
                        Text(
                          'Trusted professionals for every little job, right at your doorstep.',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 14,
                            height: 1.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 23),
                  _landingFeature(Icons.verified_user_outlined,
                      'Verified local professionals'),
                  _landingFeature(Icons.location_on_outlined,
                      'Nearby services with live tracking'),
                  _landingFeature(Icons.lock_outline_rounded,
                      'Secure and convenient payments'),
                  const Spacer(),
                  PrimaryBtn(
                    label: 'Get Started',
                    icon: Icons.arrow_forward_rounded,
                    busy: _busy,
                    onPressed: _continue,
                  ),
                  const SizedBox(height: 15),
                  Text(
                    '© Unique IT Solutions  •  A Unit of Unique Computers, The Best One',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white.withOpacity(.43),
                      fontSize: 10,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Terms & Privacy',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Color(0xFFFFB15C),
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
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 35,
            height: 35,
            decoration: BoxDecoration(
              color: const Color(0xFFFF7A00).withOpacity(.13),
              borderRadius: BorderRadius.circular(11),
            ),
            child: Icon(icon, color: const Color(0xFFFFB15C), size: 19),
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

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  String? _error;
  bool _busy = false;

  Future<void> _sendOtp() async {
    final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (!Api.isValidIndianMobile(digits)) {
      setState(() => _error = 'Enter a valid 10-digit Indian mobile number');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final devCode = await Api.sendOtp('+91$digits');
      if (!mounted) return;
      Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => OtpScreen(phone: '+91$digits', devCode: devCode)));
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF071A31),
      body: Stack(
        children: [
          Positioned(top: -90, right: -70, child: _GlowOrb(color: const Color(0xFFFF7A00).withOpacity(.28), size: 260)),
          Positioned(bottom: 80, left: -110, child: _GlowOrb(color: const Color(0xFF2476B8).withOpacity(.30), size: 280)),
          SafeArea(
            child: LayoutBuilder(builder: (context, constraints) => SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(22, 24, 22, 24),
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight - 48),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(children: [
                      Container(
                        width: 54, height: 54,
                        decoration: BoxDecoration(color: Colors.white.withOpacity(.10), borderRadius: BorderRadius.circular(17), border: Border.all(color: Colors.white.withOpacity(.18))),
                        padding: const EdgeInsets.all(8),
                        child: Image.asset('assets/kaamdaar-logo-white.png', fit: BoxFit.contain,
                          errorBuilder: (_, __, ___) => const Icon(Icons.home_repair_service, color: Color(0xFFFF7A00), size: 32)),
                      ),
                      const SizedBox(width: 12),
                      const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('KAAMDAAR', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 1.8)),
                        Text('HAR KAAM TURANT', style: TextStyle(color: Color(0xFFFFB15C), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 2)),
                      ]),
                    ]),
                    const SizedBox(height: 48),
                    const Text('Your home.\nOur responsibility.', style: TextStyle(color: Colors.white, fontSize: 32, height: 1.12, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 12),
                    Text('Trusted professionals for every little job, right at your doorstep.', style: TextStyle(color: Colors.white.withOpacity(.68), fontSize: 14, height: 1.5)),
                    const SizedBox(height: 30),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(28),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 18, sigmaY: 18),
                        child: Container(
                          padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
                          decoration: BoxDecoration(color: Colors.white.withOpacity(.10), borderRadius: BorderRadius.circular(28), border: Border.all(color: Colors.white.withOpacity(.20))),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                            const Text('Welcome back 👋', style: TextStyle(color: Colors.white, fontSize: 23, fontWeight: FontWeight.w900)),
                            const SizedBox(height: 6),
                            Text('Sign in with your mobile number to book a service.', style: TextStyle(color: Colors.white.withOpacity(.66), fontSize: 12.5)),
                            const SizedBox(height: 22),
                            const Text('MOBILE NUMBER', style: TextStyle(color: Color(0xFFFFB15C), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5)),
                            const SizedBox(height: 9),
                            Container(
                              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: _error == null ? Colors.white : const Color(0xFFDC2626), width: 1.4)),
                              child: Row(children: [
                                Container(padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 17), decoration: const BoxDecoration(border: Border(right: BorderSide(color: Color(0xFFE2E8F0)))),
                                  child: const Text('+91', style: TextStyle(color: Color(0xFF0B2240), fontWeight: FontWeight.w900))),
                                Expanded(child: TextField(
                                  controller: _phone, keyboardType: TextInputType.phone, maxLength: 10, autofocus: true,
                                  onChanged: (_) => setState(() => _error = null),
                                  style: const TextStyle(color: Color(0xFF0B2240), fontSize: 17, fontWeight: FontWeight.w800, letterSpacing: 1.1),
                                  decoration: const InputDecoration(counterText: '', hintText: '98765 43210', hintStyle: TextStyle(color: Colors.black38), border: InputBorder.none, filled: false, contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 16)),
                                )),
                              ]),
                            ),
                            if (_error != null) Padding(padding: const EdgeInsets.only(top: 9), child: Text(_error!, style: const TextStyle(color: Color(0xFFFF9B9B), fontSize: 12))),
                            const SizedBox(height: 18),
                            SizedBox(height: 54, child: ElevatedButton(
                              onPressed: _busy ? null : _sendOtp,
                              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFFF7A00), foregroundColor: const Color(0xFF0B2240), elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
                              child: _busy ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0B2240))) : const Row(mainAxisAlignment: MainAxisAlignment.center, children: [Text('Continue securely', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 15)), SizedBox(width: 8), Icon(Icons.arrow_forward_rounded, size: 19)]),
                            )),
                            const SizedBox(height: 16),
                            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Icon(Icons.verified_user_outlined, color: Colors.white.withOpacity(.55), size: 14),
                              const SizedBox(width: 6),
                              Text('OTP secured login • No password required', style: TextStyle(color: Colors.white.withOpacity(.58), fontSize: 10.5)),
                            ]),
                          ]),
                        ),
                      ),
                    ),
                    const Spacer(),
                    const SizedBox(height: 28),
                    Text('By continuing, you agree to our Terms & Privacy Policy', textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withOpacity(.48), fontSize: 11)),
                    const SizedBox(height: 8),
                    Text('© Unique IT Solutions  •  Made with care in India', textAlign: TextAlign.center, style: TextStyle(color: Colors.white.withOpacity(.35), fontSize: 10)),
                  ],
                ),
              ),
            )),
          ),
        ],
      ),
    );
  }

}

class _GlowOrb extends StatelessWidget {
  final Color color;
  final double size;
  const _GlowOrb({required this.color, required this.size});
  @override
  Widget build(BuildContext context) => Container(
    width: size, height: size,
    decoration: BoxDecoration(shape: BoxShape.circle, boxShadow: [BoxShadow(color: color, blurRadius: 90, spreadRadius: 25)]),
  );
}

class OtpScreen extends StatefulWidget {
  final String phone;
  final String devCode;
  const OtpScreen({super.key, required this.phone, this.devCode = ''});

  @override
  State<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends State<OtpScreen> {
  final _otp = TextEditingController();
  String? _error;
  bool _busy = false;

  Future<void> _verify() async {
    final code = _otp.text.replaceAll(RegExp(r'\D'), '');
    if (code.length != 6) {
      setState(() => _error = 'Enter the 6-digit OTP');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final result = await Api.verifyOtp(widget.phone, code);
      if (!mounted) return;
      // Web parity: brand-new number → complete the profile first, an existing
      // customer → booking/catalogue immediately.
      final Widget next =
          (result.isNew || result.user.firstName.trim().isEmpty)
              ? ProfileSetupScreen(user: result.user)
              : const HomeScreen(homeTab: 0);
      Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => next), (_) => false);
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Verify OTP')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: const Color(0xFFFF7A00).withOpacity(0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.shield_outlined,
                  color: Color(0xFFFF7A00), size: 44),
              alignment: Alignment.center,
            ),
            const SizedBox(height: 20),
            const Text('Verify OTP',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text('We have sent a 6-digit OTP\n${widget.phone}',
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.black54, height: 1.4)),
            if (widget.devCode.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7E6),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFFDE68A)),
                ),
                child: Text('Dev mode — your OTP is ${widget.devCode}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: Color(0xFF92400E), fontWeight: FontWeight.w600)),
              ),
            ],
            const SizedBox(height: 24),
            TextField(
              controller: _otp,
              keyboardType: TextInputType.number,
              maxLength: 6,
              autofocus: true,
              textAlign: TextAlign.center,
              style: const TextStyle(
                  fontSize: 24, fontWeight: FontWeight.w700, letterSpacing: 12),
              onChanged: (v) {
                setState(() => _error = null);
                if (v.length == 6) _verify(); // auto-verify, no button needed
              },
              decoration: const InputDecoration(counterText: '', hintText: '••••••'),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(_error!,
                    style: const TextStyle(color: Color(0xFFDC2626), fontSize: 13)),
              ),
            const SizedBox(height: 20),
            PrimaryBtn(label: 'Continue', busy: _busy, onPressed: _verify),
          ],
        ),
      ),
    );
  }
}
