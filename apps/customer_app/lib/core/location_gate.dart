import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

/// Blocks app entry until Android location permission, device location services,
/// and a real device position are available.
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

class _LocationGateState extends State<LocationGate> with WidgetsBindingObserver {
  bool _checking = true;
  bool _ready = false;
  bool _requestInProgress = false;
  bool _showSplash = true;
  String _message = 'Checking location permission…';
  bool _serviceOff = false;
  bool _permissionBlocked = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _start();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _start() async {
    await Future.delayed(const Duration(milliseconds: 1200));
    if (!mounted) return;
    setState(() => _showSplash = false);
    await _checkLocation(requestPermission: true);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_ready) {
      unawaited(_checkLocation(requestPermission: false));
    }
  }

  Future<void> _checkLocation({required bool requestPermission}) async {
    if (_requestInProgress || !mounted) return;
    _requestInProgress = true;
    setState(() {
      _checking = true;
      _serviceOff = false;
      _permissionBlocked = false;
      _message = 'Checking location permission…';
    });
    try {
      var enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        if (!mounted) return;
        setState(() {
          _serviceOff = true;
          _message = 'Please turn on your phone location to continue.';
        });
        return;
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied && requestPermission) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever ||
          permission == LocationPermission.unableToDetermine) {
        if (!mounted) return;
        setState(() {
          _permissionBlocked = permission == LocationPermission.deniedForever;
          _message = 'Location is necessary to use this app. Please allow location access to continue.';
        });
        return;
      }

      // A granted permission alone is not enough: verify that the device can
      // return a fresh fix before letting the user enter the app.
      var position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.bestForNavigation,
          timeLimit: Duration(seconds: 20),
          distanceFilter: 0,
        ),
      );
      if (position.accuracy > 50) {
        try {
          final refined = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(
              accuracy: LocationAccuracy.bestForNavigation,
              timeLimit: Duration(seconds: 15),
              distanceFilter: 0,
            ),
          );
          if (refined.accuracy < position.accuracy) position = refined;
        } catch (_) {}
      }
      if (position.accuracy > 100) {
        throw TimeoutException('GPS accuracy is too low. Move outdoors and retry.');
      }
      if (!mounted) return;
      setState(() {
        _ready = true;
        _checking = false;
      });
    } on TimeoutException {
      if (mounted) setState(() => _message = 'Could not detect your location. Turn on GPS and try again.');
    } catch (_) {
      if (mounted) setState(() => _message = 'Location could not be detected. Please check your phone location settings and try again.');
    } finally {
      _requestInProgress = false;
      if (mounted) setState(() => _checking = false);
    }
  }

  Future<void> _openSettings() async {
    if (_serviceOff) {
      await Geolocator.openLocationSettings();
    } else {
      await Geolocator.openAppSettings();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_ready) return widget.child;
    if (_showSplash) {
      return Scaffold(
        backgroundColor: widget.background,
        body: Center(
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(22)),
              child: Icon(Icons.location_on, color: widget.accent, size: 46),
            ),
            const SizedBox(height: 18),
            Text(widget.appTitle, style: const TextStyle(color: Colors.white, fontSize: 30, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text('Har Kaam Turant', style: TextStyle(color: Colors.white70)),
            const SizedBox(height: 28),
            CircularProgressIndicator(color: widget.accent),
          ]),
        ),
      );
    }
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FC),
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(color: widget.accent.withValues(alpha: .12), shape: BoxShape.circle),
                child: Icon(Icons.location_on_rounded, color: widget.accent, size: 48),
              ),
              const SizedBox(height: 22),
              const Text('Location is necessary to use this app',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF10243D))),
              const SizedBox(height: 10),
              Text(_message, textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14, height: 1.5, color: Color(0xFF64748B))),
              const SizedBox(height: 24),
              if (_checking) const CircularProgressIndicator()
              else if (_serviceOff || _permissionBlocked)
                SizedBox(width: double.infinity, child: ElevatedButton.icon(
                  onPressed: _openSettings,
                  icon: const Icon(Icons.settings),
                  label: Text(_serviceOff ? 'Open Location Settings' : 'Open App Settings'),
                  style: ElevatedButton.styleFrom(backgroundColor: widget.accent, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 15)),
                ))
              else
                SizedBox(width: double.infinity, child: ElevatedButton.icon(
                  onPressed: () => _checkLocation(requestPermission: true),
                  icon: const Icon(Icons.my_location),
                  label: const Text('Allow Location'),
                  style: ElevatedButton.styleFrom(backgroundColor: widget.accent, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 15)),
                )),
              const SizedBox(height: 10),
              TextButton(
                onPressed: () => _checkLocation(requestPermission: false),
                child: const Text('I have enabled location — Retry'),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
