import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

/// First screen shown on launch: request and verify location before app access.
class LocationGate extends StatefulWidget {
  final Widget child;
  final String appTitle;
  final Color background;
  final Color accent;

  const LocationGate({
    super.key,
    required this.child,
    required this.appTitle,
    required this.background,
    required this.accent,
  });

  @override
  State<LocationGate> createState() => _LocationGateState();
}

class _LocationGateState extends State<LocationGate>
    with WidgetsBindingObserver {
  bool _checking = true;
  bool _ready = false;
  bool _busy = false;
  bool _serviceOff = false;
  bool _permissionBlocked = false;
  bool _permissionGranted = false;
  double? _accuracy;
  String _message = 'Checking location permission…';

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
    if (state == AppLifecycleState.resumed && !_ready) {
      unawaited(_verify(requestPermission: false));
    }
  }

  Future<void> _verify({required bool requestPermission}) async {
    if (_busy || !mounted || _ready) return;
    _busy = true;
    setState(() {
      _checking = true;
      _serviceOff = false;
      _permissionBlocked = false;
      _permissionGranted = false;
      _accuracy = null;
      _message = 'Checking GPS permission and device settings…';
    });

    try {
      if (!await Geolocator.isLocationServiceEnabled()) {
        _serviceOff = true;
        throw const _GateError(
          'Turn on Location Services / GPS in phone settings, then retry.',
        );
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied && requestPermission) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever ||
          permission == LocationPermission.unableToDetermine) {
        _permissionBlocked = permission == LocationPermission.deniedForever;
        throw _GateError(
          _permissionBlocked
              ? 'Location permission is blocked. Open App Settings and allow location access.'
              : 'Location permission is required. Please allow it to continue.',
        );
      }

      _permissionGranted = true;
      if (mounted) {
        setState(() => _message = 'Verifying your current GPS location…');
      }

      var fix = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.bestForNavigation,
          timeLimit: Duration(seconds: 20),
          distanceFilter: 0,
        ),
      );

      if (fix.accuracy > 50) {
        try {
          final refined = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.bestForNavigation,
              timeLimit: Duration(seconds: 15),
              distanceFilter: 0,
            ),
          );
          if (refined.accuracy < fix.accuracy) fix = refined;
        } on TimeoutException {
          // Keep the first valid GPS fix.
        }
      }

      if (fix.accuracy > 100) {
        throw const _GateError(
          'GPS signal is weak (over 100 metres). Move outdoors and retry.',
        );
      }

      if (!mounted) return;
      setState(() {
        _accuracy = fix.accuracy;
        _message = 'Location verified successfully.';
        _ready = true;
        _checking = false;
      });
    } on _GateError catch (e) {
      if (mounted) setState(() => _message = e.message);
    } on TimeoutException {
      if (mounted) {
        setState(() => _message =
            'GPS is taking too long. Turn on GPS, move outdoors and retry.');
      }
    } catch (_) {
      if (mounted) {
        setState(() => _message =
            'Location could not be verified. Check GPS and permission, then retry.');
      }
    } finally {
      _busy = false;
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _settings() async {
    if (_serviceOff) {
      await Geolocator.openLocationSettings();
    } else {
      await Geolocator.openAppSettings();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_ready) return widget.child;

    return Scaffold(
      backgroundColor: const Color(0xFF071A31),
      body: Stack(
        children: [
          Positioned(
            top: -115,
            right: -105,
            child: _Glow(color: const Color(0xFF0E9F6E).withOpacity(.25)),
          ),
          Positioned(
            bottom: -110,
            left: -110,
            child: _Glow(color: const Color(0xFFFF7A00).withOpacity(.16)),
          ),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(22, 24, 22, 22),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 460),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 54,
                            height: 54,
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(.10),
                              borderRadius: BorderRadius.circular(17),
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
                                size: 30,
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
                                  fontSize: 19,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1.7,
                                ),
                              ),
                              SizedBox(height: 3),
                              Text(
                                'PARTNER NETWORK',
                                style: TextStyle(
                                  color: Color(0xFF69D5B0),
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 1.6,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 34),
                      const Text(
                        'A quick permission check',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 27,
                          height: 1.15,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Text(
                        'Allow location access so Kaamdaar can send you nearby service requests and help you navigate to customers.',
                        style: TextStyle(
                          color: Colors.white.withOpacity(.68),
                          fontSize: 14,
                          height: 1.55,
                        ),
                      ),
                      const SizedBox(height: 25),
                      _step(
                        Icons.location_on_outlined,
                        'Location permission',
                        'Allow Kaamdaar to access device location',
                        _permissionGranted,
                      ),
                      const SizedBox(height: 10),
                      _step(
                        Icons.gps_fixed_rounded,
                        'GPS / Location Services',
                        'Keep your phone location setting switched on',
                        !_serviceOff && !_checking,
                      ),
                      const SizedBox(height: 10),
                      _step(
                        Icons.verified_user_outlined,
                        'Accurate location fix',
                        'Fresh GPS reading with accuracy up to 100 metres',
                        _ready,
                      ),
                      const SizedBox(height: 18),
                      if (_checking)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 12),
                          child: LinearProgressIndicator(
                            minHeight: 3,
                            color: Color(0xFF69D5B0),
                            backgroundColor: Colors.white12,
                          ),
                        ),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(15),
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(.08),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: Colors.white.withOpacity(.15),
                          ),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Icon(
                              _checking
                                  ? Icons.radar_rounded
                                  : Icons.info_outline_rounded,
                              color: const Color(0xFF69D5B0),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                _ready && _accuracy != null
                                    ? 'Verified · GPS accuracy ${_accuracy!.toStringAsFixed(0)} metres'
                                    : _message,
                                style: TextStyle(
                                  color: Colors.white.withOpacity(.82),
                                  fontSize: 13,
                                  height: 1.45,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 18),
                      SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: ElevatedButton.icon(
                          onPressed: _checking
                              ? null
                              : () => _verify(requestPermission: true),
                          icon: _checking
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Color(0xFF071A31),
                                  ),
                                )
                              : const Icon(Icons.my_location_rounded),
                          label: Text(
                            _checking
                                ? 'VERIFYING LOCATION…'
                                : 'ALLOW & CONTINUE',
                            style: const TextStyle(
                              fontSize: 13,
                              letterSpacing: .5,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0E9F6E),
                            foregroundColor: Colors.white,
                            disabledBackgroundColor:
                                const Color(0xFF0E9F6E).withOpacity(.45),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(15),
                            ),
                            elevation: 0,
                          ),
                        ),
                      ),
                      if (_serviceOff || _permissionBlocked) ...[
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          height: 50,
                          child: OutlinedButton.icon(
                            onPressed: _settings,
                            icon: const Icon(Icons.settings_rounded),
                            label: Text(
                              _serviceOff
                                  ? 'OPEN LOCATION SETTINGS'
                                  : 'OPEN APP SETTINGS',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFF9DDCC8),
                              side: BorderSide(
                                color: const Color(0xFF9DDCC8).withOpacity(.4),
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(15),
                              ),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 22),
                      Text(
                        'Your landing page and login will open after location verification.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withOpacity(.48),
                          fontSize: 11,
                        ),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        '© Unique IT Solutions · A Unit of Unique Computers, The Best One',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Colors.white.withOpacity(.34),
                          fontSize: 9,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _step(IconData icon, String title, String subtitle, bool done) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(.14)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFF69D5B0).withOpacity(.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: const Color(0xFF69D5B0), size: 21),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  subtitle,
                  style: TextStyle(
                    color: Colors.white.withOpacity(.54),
                    fontSize: 11,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            done ? Icons.check_circle_rounded : Icons.radio_button_unchecked,
            color: done
                ? const Color(0xFF69D5B0)
                : Colors.white.withOpacity(.35),
            size: 20,
          ),
        ],
      ),
    );
  }
}

class _Glow extends StatelessWidget {
  final Color color;
  const _Glow({required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 270,
      height: 270,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(color: color, blurRadius: 90, spreadRadius: 25),
        ],
      ),
    );
  }
}

class _GateError implements Exception {
  final String message;
  const _GateError(this.message);
}
