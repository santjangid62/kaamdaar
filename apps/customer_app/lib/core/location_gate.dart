import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

/// Shared blocking location gate for Customer and Provider apps.
class LocationGate extends StatefulWidget {
  final Widget child;
  final String appTitle;
  final Color background;
  final Color accent;
  const LocationGate({super.key, required this.child, required this.appTitle,
    required this.background, required this.accent});
  @override
  State<LocationGate> createState() => _LocationGateState();
}

class _LocationGateState extends State<LocationGate> with WidgetsBindingObserver {
  bool _checking = true, _ready = false, _busy = false, _splash = true;
  bool _serviceOff = false, _permissionBlocked = false, _permissionGranted = false;
  double? _accuracy;
  String _message = 'Checking location permission…';

  @override
  void initState() { super.initState(); WidgetsBinding.instance.addObserver(this); _start(); }
  @override
  void dispose() { WidgetsBinding.instance.removeObserver(this); super.dispose(); }

  Future<void> _start() async {
    await Future.delayed(const Duration(milliseconds: 900));
    if (!mounted) return;
    setState(() => _splash = false);
    await _verify(requestPermission: true);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_ready) {
      unawaited(_verify(requestPermission: false));
    }
  }

  Future<void> _verify({required bool requestPermission}) async {
    if (_busy || !mounted || _ready) return;
    _busy = true;
    setState(() {
      _checking = true; _serviceOff = false; _permissionBlocked = false; _permissionGranted = false;
      _accuracy = null; _message = 'Checking GPS permission and device settings…';
    });
    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        _serviceOff = true;
        throw const _GateError('Turn on Location Services / GPS in phone settings, then retry.');
      }
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied && requestPermission) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever ||
          permission == LocationPermission.unableToDetermine) {
        _permissionBlocked = permission == LocationPermission.deniedForever;
        throw _GateError(_permissionBlocked
            ? 'Location permission is blocked. Open App Settings and allow location access.'
            : 'Location permission is required. Please allow it to continue.');
      }
      _permissionGranted = true;
      if (mounted) setState(() => _message = 'Verifying your current GPS location…');
      var fix = await Geolocator.getCurrentPosition(locationSettings:
          const LocationSettings(accuracy: LocationAccuracy.bestForNavigation,
            timeLimit: Duration(seconds: 20), distanceFilter: 0));
      if (fix.accuracy > 50) {
        try {
          final refined = await Geolocator.getCurrentPosition(locationSettings:
              const LocationSettings(accuracy: LocationAccuracy.bestForNavigation,
                timeLimit: Duration(seconds: 15), distanceFilter: 0));
          if (refined.accuracy < fix.accuracy) fix = refined;
        } on TimeoutException { /* retain first fix */ }
      }
      if (fix.accuracy > 100) {
        throw const _GateError('GPS signal is weak (over 100 metres). Move outdoors and retry.');
      }
      if (!mounted) return;
      setState(() {
        _accuracy = fix.accuracy; _message = 'Location verified successfully.';
        _ready = true; _checking = false;
      });
    } on _GateError catch (e) {
      if (mounted) setState(() => _message = e.message);
    } on TimeoutException {
      if (mounted) setState(() => _message = 'GPS is taking too long. Turn on GPS, move outdoors and retry.');
    } catch (_) {
      if (mounted) setState(() => _message = 'Location could not be verified. Check GPS and permission, then retry.');
    } finally {
      _busy = false;
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _settings() async {
    if (_serviceOff) { await Geolocator.openLocationSettings(); }
    else { await Geolocator.openAppSettings(); }
  }

  @override
  Widget build(BuildContext context) {
    if (_ready) return widget.child;
    if (_splash) return Scaffold(
      backgroundColor: widget.background,
      body: SafeArea(child: Column(children: [
        const Spacer(),
        Image.asset('assets/kaamdaar-logo-white.png', width: 290, height: 145,
          fit: BoxFit.contain, errorBuilder: (_, __, ___) => Text(widget.appTitle.toUpperCase(),
            style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900))),
        const SizedBox(height: 12),
        const Text('HAR KAAM TURANT', style: TextStyle(color: Color(0xFFFFC857),
          fontSize: 12, letterSpacing: 2, fontWeight: FontWeight.w800)),
        const SizedBox(height: 28), CircularProgressIndicator(color: widget.accent),
        const Spacer(),
        const Text('Unique IT Solutions · A Unit of Unique Computers',
          style: TextStyle(color: Colors.white70, fontSize: 10)),
        const SizedBox(height: 22),
      ])),
    );

    return Scaffold(
      backgroundColor: const Color(0xFFF3F6FA),
      body: SafeArea(child: Center(child: SingleChildScrollView(
        padding: const EdgeInsets.all(22),
        child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 460),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 76, height: 76,
              decoration: BoxDecoration(color: widget.background, borderRadius: BorderRadius.circular(24),
                boxShadow: [BoxShadow(color: widget.background.withValues(alpha: .18),
                  blurRadius: 22, offset: const Offset(0, 10))]),
              child: const Icon(Icons.my_location_rounded, color: Colors.white, size: 36)),
            const SizedBox(height: 22),
            const Text('LOCATION VERIFICATION', style: TextStyle(color: Color(0xFF64748B),
              fontSize: 11, letterSpacing: 2, fontWeight: FontWeight.w900)),
            const SizedBox(height: 9),
            const Text('Verify your current location', textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF10243A), fontSize: 25,
                height: 1.15, fontWeight: FontWeight.w900)),
            const SizedBox(height: 10),
            const Text('For accurate nearby services and safe bookings, verify this device location before continuing to Kaamdaar.',
              textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF64748B),
                fontSize: 14, height: 1.55)),
            const SizedBox(height: 24),
            _step(Icons.lock_outline_rounded, 'Location permission',
              'Allow Kaamdaar to access device location',
              _permissionGranted),
            const SizedBox(height: 10),
            _step(Icons.gps_fixed_rounded, 'GPS / Location Services',
              'Keep your phone location setting switched on', !_serviceOff && !_checking),
            const SizedBox(height: 10),
            _step(Icons.verified_user_outlined, 'Accurate location fix',
              'Fresh GPS reading with accuracy up to 100 metres', _ready),
            const SizedBox(height: 18),
            if (_checking) const Padding(padding: EdgeInsets.only(bottom: 12),
              child: LinearProgressIndicator(minHeight: 4)),
            Container(width: double.infinity, padding: const EdgeInsets.all(15),
              decoration: BoxDecoration(
                color: _ready ? const Color(0xFFE8F8EF) : const Color(0xFFFFF7E8),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: _ready ? const Color(0xFFB7E5C8) : const Color(0xFFF4D9A6))),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(_ready ? Icons.check_circle_rounded :
                  (_checking ? Icons.radar_rounded : Icons.info_outline_rounded),
                  color: _ready ? const Color(0xFF16834A) : const Color(0xFF9A6500)),
                const SizedBox(width: 10),
                Expanded(child: Text(_ready && _accuracy != null
                  ? 'Verified · GPS accuracy ' + _accuracy!.toStringAsFixed(0) + ' metres'
                  : _message, style: const TextStyle(color: Color(0xFF34445A),
                    fontSize: 13, height: 1.45, fontWeight: FontWeight.w600))),
              ])),
            const SizedBox(height: 18),
            SizedBox(width: double.infinity, height: 54,
              child: ElevatedButton.icon(
                onPressed: _checking ? null : () => _verify(requestPermission: true),
                icon: _checking ? const SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.my_location_rounded),
                label: Text(_checking ? 'VERIFYING LOCATION…' : 'RETRY LOCATION VERIFICATION',
                  style: const TextStyle(fontSize: 12, letterSpacing: .4, fontWeight: FontWeight.w900)),
                style: ElevatedButton.styleFrom(backgroundColor: widget.background,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: widget.background.withValues(alpha: .55),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                  elevation: 0))),
            if (_serviceOff || _permissionBlocked) ...[
              const SizedBox(height: 10),
              SizedBox(width: double.infinity, height: 50,
                child: OutlinedButton.icon(onPressed: _settings,
                  icon: const Icon(Icons.settings_rounded),
                  label: Text(_serviceOff ? 'OPEN LOCATION SETTINGS' : 'OPEN APP SETTINGS',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
                  style: OutlinedButton.styleFrom(foregroundColor: widget.background,
                    side: BorderSide(color: widget.background.withValues(alpha: .25)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15))))),
            ],
            const SizedBox(height: 20),
            const Text('Login and dashboard unlock only after location verification.',
              textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF8491A2), fontSize: 11)),
            const SizedBox(height: 12),
            const Text('© Unique IT Solutions · A Unit of Unique Computers, The Best One',
              textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF9AA5B3), fontSize: 9)),
          ])),
      ))),
    );
  }

  Widget _step(IconData icon, String title, String subtitle, bool done) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16),
      border: Border.all(color: const Color(0xFFE4EAF1))),
    child: Row(children: [
      Container(width: 40, height: 40,
        decoration: BoxDecoration(color: widget.accent.withValues(alpha: .12),
          borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: widget.background, size: 21)),
      const SizedBox(width: 12),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(color: Color(0xFF1D2E43),
          fontSize: 13, fontWeight: FontWeight.w800)),
        const SizedBox(height: 3),
        Text(subtitle, style: const TextStyle(color: Color(0xFF8491A2), fontSize: 11, height: 1.35)),
      ])),
      Icon(done ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
        color: done ? const Color(0xFF16834A) : const Color(0xFFB5C0CC), size: 20),
    ]),
  );
}

class _GateError implements Exception {
  final String message;
  const _GateError(this.message);
}
