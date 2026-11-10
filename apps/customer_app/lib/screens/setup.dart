/// Profile completion — the app's answer to the web's `/profile?setup=1`.
///
/// A first-time customer is created by the backend with an empty name, so the
/// app sends them here before the catalogue; returning customers skip it.
library;
import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'home.dart';

class ProfileSetupScreen extends StatefulWidget {
  final SessionUser user;
  const ProfileSetupScreen({super.key, required this.user});

  @override
  State<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends State<ProfileSetupScreen> {
  final _form = GlobalKey<FormState>();
  late final _first = TextEditingController(text: widget.user.firstName);
  late final _last = TextEditingController(text: widget.user.lastName);
  late final _email = TextEditingController(text: widget.user.email);
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _first.dispose();
    _last.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await Api.updateProfile(widget.user.id, {
        'firstName': _first.text.trim(),
        'lastName': _last.text.trim(),
        'email': _email.text.trim(),
      });
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const HomeScreen(homeTab: 0)),
          (route) => false);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
          child: Form(
            key: _form,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [KColors.navy, Color(0xFF173A6B)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(22),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          CircleAvatar(
                            radius: 24,
                            backgroundColor: Colors.white24,
                            child: Text(
                              (_first.text.trim().isEmpty
                                      ? 'K'
                                      : _first.text.trim()[0])
                                  .toUpperCase(),
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w900),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Ek aakhri step',
                                    style: TextStyle(
                                        color: Color(0xFFFFB27A),
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w700,
                                        letterSpacing: .4)),
                                Text('+91 ${widget.user.phone.replaceFirst('+91', '')}',
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        fontWeight: FontWeight.w800)),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 9, vertical: 4),
                            decoration: BoxDecoration(
                                color: KColors.green.withOpacity(.22),
                                borderRadius: BorderRadius.circular(999)),
                            child: const Text('Verified',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      const Text('Complete your profile',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 23,
                              height: 1.15,
                              fontWeight: FontWeight.w900)),
                      const SizedBox(height: 6),
                      const Text(
                          'Naam aur email se Pro aapko pehchaan sake aur booking updates bhej sake.',
                          style: TextStyle(
                              color: Colors.white70, fontSize: 12.5, height: 1.45)),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: const [
                    _StepDot(n: 1, label: 'OTP'),
                    Expanded(child: _StepLine()),
                    _StepDot(n: 2, label: 'Profile', active: true),
                    Expanded(child: _StepLine(dim: true)),
                    _StepDot(n: 3, label: 'Book', dim: true),
                  ],
                ),
                const SizedBox(height: 20),
                TextFormField(
                  controller: _first,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(
                      labelText: 'First name', hintText: 'e.g. Ramesh'),
                  validator: (v) => _nameError(v, 'First name'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _last,
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  decoration: const InputDecoration(
                      labelText: 'Last name', hintText: 'e.g. Sharma'),
                  validator: (v) => _nameError(v, 'Last name'),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  onFieldSubmitted: (_) => _submit(),
                  decoration: const InputDecoration(
                    labelText: 'Email (optional)',
                    hintText: 'you@example.com',
                  ),
                  validator: (v) {
                    final e = (v ?? '').trim();
                    if (e.isEmpty) return null;
                    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$').hasMatch(e)
                        ? null
                        : 'Enter a valid email address';
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: KColors.red.withOpacity(.08),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(_error!,
                        style: const TextStyle(
                            color: KColors.red, fontSize: 12.5)),
                  ),
                ],
                const SizedBox(height: 20),
                PrimaryBtn(
                    label: 'Save & Start Booking',
                    icon: Icons.arrow_forward,
                    busy: _busy,
                    onPressed: _busy ? null : _submit),
                const SizedBox(height: 12),
                const Text(
                    'Aap ye details baad me Profile tab se badal sakte hain.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.black45, fontSize: 11.5)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Backend rule: 2–60 letters, spaces/apostrophes/hyphens allowed.
  String? _nameError(String? value, String field) {
    final v = (value ?? '').trim();
    if (v.length < 2) return '$field must be at least 2 characters';
    if (v.length > 60) return '$field is too long';
    if (!RegExp(r"^[\p{L}][\p{L}\s'.-]*$", unicode: true).hasMatch(v)) {
      return '$field can only contain letters';
    }
    return null;
  }
}

class _StepDot extends StatelessWidget {
  final int n;
  final String label;
  final bool active;
  final bool dim;
  const _StepDot(
      {required this.n, required this.label, this.active = false, this.dim = false});

  @override
  Widget build(BuildContext context) {
    final color = active
        ? KColors.flame
        : (dim ? const Color(0xFFE2E8F0) : KColors.green);
    return Column(
      children: [
        Container(
          height: 26,
          width: 26,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          child: dim
              ? Text('$n',
                  style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Colors.black45))
              : Icon(
                  active ? Icons.person_outline : Icons.check,
                  size: 14,
                  color: active ? KColors.navy : Colors.white,
                ),
        ),
        const SizedBox(height: 4),
        Text(label,
            style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w700,
                color: active ? KColors.navy : Colors.black38)),
      ],
    );
  }
}

class _StepLine extends StatelessWidget {
  final bool dim;
  const _StepLine({this.dim = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 2,
      margin: const EdgeInsets.only(bottom: 16, left: 6, right: 6),
      color: dim ? const Color(0xFFE2E8F0) : const Color(0xFFFFC9A3),
    );
  }
}
