/// Live job offers, the way a Rapido driver sees one.
///
/// The Pro app polls its dispatch inbox; when a fresh offer that carries this
/// Pro's id in `notifiedIds` shows up, a full-screen alert rings for 30 seconds
/// on top of whatever screen is open (sound loops until it is answered) with
/// Accept / Reject. Accept allots the job server-side and opens it; Reject
/// withdraws only this Pro's offer. Every declined or ignored offer is kept
/// locally so the dashboard can show "aaj accept nahi kiye" counts.
library;

import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../screens/job.dart';
import '../screens/job_alert.dart';
import 'api.dart';
import 'models.dart';

/// Root navigator so an incoming offer can interrupt any screen.
final GlobalKey<NavigatorState> jobAlertNavigatorKey =
    GlobalKey<NavigatorState>();

/// One offer the Pro did not take (rejected, or the 30s window ran out).
class MissedJob {
  final String id;
  final String service;
  final String reason; // "declined" | "expired"
  final int at;

  const MissedJob({
    required this.id,
    required this.service,
    required this.reason,
    required this.at,
  });

  bool get isToday {
    final d = DateTime.fromMillisecondsSinceEpoch(at);
    final n = DateTime.now();
    return d.year == n.year && d.month == n.month && d.day == n.day;
  }

  bool get expired => reason == "expired";

  String get reasonLabel => expired ? "30s me reply nahi kiya" : "Reject kiya";

  Map<String, dynamic> toJson() =>
      {"id": id, "service": service, "reason": reason, "at": at};

  factory MissedJob.fromJson(Map<String, dynamic> j) => MissedJob(
        id: (j["id"] ?? "").toString(),
        service: (j["service"] ?? "").toString(),
        reason: (j["reason"] ?? "declined").toString(),
        at: (j["at"] as num?)?.toInt() ?? 0,
      );
}

class JobAlertCenter {
  JobAlertCenter._();
  static final JobAlertCenter instance = JobAlertCenter._();

  static const _kMissed = "kaamdaar.provider.missed";
  static const _kHandled = "kaamdaar.provider.handled";

  /// How long the offer rings before it gives up on its own.
  static const int alertSeconds = 30;
  static const Duration _tick = Duration(seconds: 3);

  final ValueNotifier<List<MissedJob>> missed =
      ValueNotifier<List<MissedJob>>(const []);

  /// Native alarm player (res/raw/job_alert.wav) — a plugin-free channel, so
  /// the build stays clean on Windows paths with spaces.
  static const MethodChannel _alarm = MethodChannel('kaamdaar/alerts');
  Timer? _poll;
  ProviderItem? _me;
  String? _ringing;
  bool _checking = false;
  bool _started = false;
  final Set<String> _handled = <String>{};

  List<MissedJob> get missedToday =>
      missed.value.where((m) => m.isToday).toList();

  /// Loads the persisted history (call once at app start).
  Future<void> loadMissed() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_kMissed);
    if (raw != null) {
      try {
        final list = (jsonDecode(raw) as List)
            .whereType<Map<String, dynamic>>()
            .map(MissedJob.fromJson)
            .toList();
        missed.value = _prune(list);
      } catch (_) {
        missed.value = const [];
      }
    }
    _handled
      ..clear()
      ..addAll(p.getStringList(_kHandled) ?? const []);
  }

  Future<void> start({
    required SessionUser user, // kept in the signature so callers pass the session
    required ProviderItem me,
  }) async {
    _me = me;
    if (!_started) await loadMissed();
    if (_started) return;
    _started = true;
    _poll?.cancel();
    _poll = Timer.periodic(_tick, (_) => _check());
    _check();
  }

  void stop() {
    _poll?.cancel();
    _poll = null;
    _started = false;
    _ringing = null;
    _silence();
  }

  /* ------------------------------ polling ------------------------------ */

  Future<void> _check() async {
    final me = _me;
    if (me == null || _ringing != null || _checking) return;
    _checking = true;
    try {
      final jobs = await Api.inbox(me.id);
      final now = DateTime.now().millisecondsSinceEpoch;
      final fresh = jobs
          .where((b) =>
              b.status == "dispatched" &&
              b.notifiedIds.contains(me.id) &&
              !_handled.contains(b.id) &&
              now - b.createdAt >= -5000 &&
              now - b.createdAt <= alertSeconds * 1000)
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      if (fresh.isEmpty) return;
      await _ring(fresh.first, me);
    } catch (_) {
      // Network hiccup — the next tick retries.
    } finally {
      _checking = false;
    }
  }

  Future<void> _ring(BookingItem booking, ProviderItem me) async {
    final nav = jobAlertNavigatorKey.currentState;
    if (nav == null) return;
    _ringing = booking.id;
    await _siren(true);
    final decision = await nav.push<String>(
      PageRouteBuilder<String>(
        opaque: true,
        transitionDuration: const Duration(milliseconds: 200),
        pageBuilder: (_, _, _) => JobAlertScreen(booking: booking),
        transitionsBuilder: (_, anim, _, child) =>
            FadeTransition(opacity: anim, child: child),
      ),
    );
    await _siren(false);
    _ringing = null;
    _handled.add(booking.id);
    await _persistHandled();

    if (decision == "accepted") {
      await _accept(booking, me);
    } else {
      await _decline(booking, me, decision == "expired" ? "expired" : "declined");
    }
  }

  Future<void> _accept(BookingItem booking, ProviderItem me) async {
    final nav = jobAlertNavigatorKey.currentState;
    final messenger =
        nav == null ? null : ScaffoldMessenger.maybeOf(nav.context);
    try {
      final updated = await Api.accept(booking, me);
      if (nav == null) return;
      // Kept on top of the shell (not replacing it) so the watcher and the
      // missed counter keep working when the Pro comes back.
      nav.push(MaterialPageRoute(
          builder: (_) => JobDetailScreen(bookingId: updated.id, provider: me)));
    } catch (e) {
      final message = e.toString().contains("already accepted")
          ? "Kisi aur Pro ne pehle accept kar liya"
          : e.toString();
      messenger?.showSnackBar(SnackBar(content: Text(message)));
    }
  }

  Future<void> _decline(
      BookingItem booking, ProviderItem me, String reason) async {
    if (reason != "expired") {
      try {
        await Api.decline(booking, me.id);
      } catch (_) {
        // The 30s window already closed server-side; still count it locally.
      }
    }
    final now = DateTime.now().millisecondsSinceEpoch;
    final next = [
      ...missed.value.where((m) => m.id != booking.id),
      MissedJob(
          id: booking.id,
          service: booking.serviceName,
          reason: reason,
          at: now),
    ];
    missed.value = _prune(next);
    await _persistMissed();
  }

  /* ---------------------------- sound + disk ---------------------------- */

  Future<void> _siren(bool on) async {
    try {
      await _alarm.invokeMethod<void>(on ? 'startAlarm' : 'stopAlarm');
    } catch (_) {
      // A device with no audio route must still show the alert.
    }
  }

  void _silence() {
    _alarm.invokeMethod<void>('stopAlarm').catchError((_) {});
  }

  Future<void> _persistMissed() async {
    final p = await SharedPreferences.getInstance();
    await p.setString(_kMissed, jsonEncode(missed.value.map((m) => m.toJson()).toList()));
  }

  Future<void> _persistHandled() async {
    final p = await SharedPreferences.getInstance();
    final list = _handled.toList();
    if (list.length > 120) list.removeRange(0, list.length - 120);
    await p.setStringList(_kHandled, list);
  }

  /// Keeps a week of history; anything older is noise.
  List<MissedJob> _prune(List<MissedJob> list) {
    final cutoff = DateTime.now()
        .subtract(const Duration(days: 7))
        .millisecondsSinceEpoch;
    final kept = list.where((m) => m.at >= cutoff).toList()
      ..sort((a, b) => a.at.compareTo(b.at));
    return List<MissedJob>.unmodifiable(kept);
  }
}
