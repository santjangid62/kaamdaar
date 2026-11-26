/// Splash → Onboarding → Login → OTP (mirrors the web flow).
library;
import 'dart:ui';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/theme.dart';
import 'home.dart';
import 'setup.dart';

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
    await Future.delayed(const Duration(milliseconds: 1500));
    if (!mounted) return;
    final seen = await Api.onboarded;
    final user = await Api.restoreSession();
    if (!mounted) return;
    // Returning customers go straight to booking; an account created but never
    // completed (empty name) is sent back to the profile step, like the web.
    final Widget next = !seen
        ? const OnboardingScreen()
        : (user == null
            ? const LoginScreen()
            : (user.firstName.trim().isEmpty
                ? ProfileSetupScreen(user: user)
                : const HomeScreen(homeTab: 0)));
    Navigator.of(context)
        .pushReplacement(MaterialPageRoute(builder: (_) => next));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B2240),
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
            const SizedBox(height: 18),
            const Text('HAR KAAM TURANT',
                style: TextStyle(color: Color(0xFFFFC857), fontSize: 14, letterSpacing: 2, fontWeight: FontWeight.w800)),
            const SizedBox(height: 24),
            const SizedBox(
              width: 26,
              height: 26,
              child: CircularProgressIndicator(
                  strokeWidth: 2, color: Color(0xFFFF7A00)),
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
                      style: TextStyle(color: Color(0xFFFFC857), fontSize: 9, fontWeight: FontWeight.w700)),
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
    (Icons.cleaning_services, 'Har Kaam Turant Book Karein',
        'Plumbing, Electrical, Cleaning, AC Repair, Painting aur kai aur services'),
    (Icons.mic_none, 'Voice Se Book Karein',
        'Bas boliye, Kaamdaar samajh kar turant service dikhayega'),
    (Icons.verified_user_outlined, 'Trusted & Secure',
        'Verified Professionals\nLive Tracking • Safe Payments'),
  ];

  Future<void> _done() async {
    await Api.setOnboarded();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
        MaterialPageRoute(builder: (_) => const LoginScreen()));
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
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(34),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFF7A00).withOpacity(0.12),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(icon, size: 84, color: const Color(0xFFFF7A00)),
                        ),
                        const SizedBox(height: 40),
                        Text(title,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 24, fontWeight: FontWeight.w800)),
                        const SizedBox(height: 12),
                        Text(sub,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 15, height: 1.5, color: Colors.black54)),
                      ],
                    ),
                  );
                },
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                _slides.length,
                (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 250),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: i == _index ? 22 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: i == _index
                        ? const Color(0xFFFF7A00)
                        : Colors.black12,
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(24),
              child: Row(
                children: [
                  TextButton(
                    onPressed: _done,
                    child: const Text('Skip', style: TextStyle(color: Colors.grey)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: PrimaryBtn(
                      label: _index == _slides.length - 1 ? 'Get Started' : 'Next →',
                      onPressed: () {
                        if (_index == _slides.length - 1) {
                          _done();
                        } else {
                          _page.nextPage(
                              duration: const Duration(milliseconds: 300),
                              curve: Curves.easeOut);
                        }
                      },
                    ),
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

class _SocialButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;
  const _SocialButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        width: 56,
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Text(label,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
      ),
    );
  }
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
