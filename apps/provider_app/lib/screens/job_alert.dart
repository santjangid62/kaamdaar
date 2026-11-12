/// Full-screen incoming-job alert: rings for 40 seconds and answers with
/// `accepted`, `rejected` or `expired` (the value pops back to JobAlertCenter).
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/job_alerts.dart';
import '../core/models.dart';
import '../core/theme.dart';

class JobAlertScreen extends StatefulWidget {
  final BookingItem booking;
  const JobAlertScreen({super.key, required this.booking});

  @override
  State<JobAlertScreen> createState() => _JobAlertScreenState();
}

class _JobAlertScreenState extends State<JobAlertScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse;
  Timer? _ticker;
  late int _left;
  bool _decided = false;

  @override
  void initState() {
    super.initState();
    // Count down from the server's original 40-second deadline, not from
    // when a delayed/background notification happens to open this screen.
    final expiresAt = widget.booking.offerExpiresAt ??
        (widget.booking.createdAt + JobAlertCenter.alertSeconds * 1000);
    final remainingMs = expiresAt - DateTime.now().millisecondsSinceEpoch;
    _left = remainingMs <= 0 ? 0 : (remainingMs / 1000).ceil();
    // The offer deserves attention: keep the screen awake and buzz once.
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    HapticFeedback.heavyImpact();
    _pulse = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 900))
      ..repeat(reverse: true);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_left <= 1) {
        _finish('expired');
      } else {
        setState(() => _left -= 1);
        if (_left == 15) HapticFeedback.mediumImpact();
      }
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  void _finish(String decision) {
    if (_decided || !mounted) return;
    _decided = true;
    _ticker?.cancel();
    Navigator.of(context).pop(decision);
  }

  @override
  Widget build(BuildContext context) {
    final b = widget.booking;
    final earn = b.amount - commissionOf(b.amount);
    final progress = _left / JobAlertCenter.alertSeconds;
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF06121F),
        body: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF06121F), Color(0xFF0B2A22)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(18, 6, 18, 18),
              child: Column(
                children: [
                  /* countdown strip */
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: PColors.flame,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.bolt, size: 13, color: Colors.white),
                            SizedBox(width: 3),
                            Text('LIVE REQUEST',
                                style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 10.5,
                                    letterSpacing: .8,
                                    fontWeight: FontWeight.w900)),
                          ],
                        ),
                      ),
                      const Spacer(),
                      Icon(Icons.timer_outlined,
                          size: 15,
                          color: _left <= 10 ? PColors.red : Colors.white70),
                      const SizedBox(width: 4),
                      Text('${_left}s',
                          style: TextStyle(
                              color: _left <= 10 ? PColors.red : Colors.white,
                              fontSize: 15,
                              fontWeight: FontWeight.w900)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(99),
                    child: LinearProgressIndicator(
                      value: progress,
                      minHeight: 5,
                      backgroundColor: Colors.white12,
                      valueColor: AlwaysStoppedAnimation(
                          _left <= 10 ? PColors.red : PColors.green),
                    ),
                  ),

                  const Spacer(),
                  ScaleTransition(
                    scale: Tween<double>(begin: .94, end: 1.06).animate(
                        CurvedAnimation(parent: _pulse, curve: Curves.easeInOut)),
                    child: Container(
                      height: 116,
                      width: 116,
                      decoration: BoxDecoration(
                        color: PColors.green.withValues(alpha: .16),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                              color: PColors.green.withValues(alpha: .35),
                              blurRadius: 34,
                              spreadRadius: 2),
                        ],
                      ),
                      child: const Icon(Icons.notifications_active,
                          color: PColors.green, size: 58),
                    ),
                  ),
                  const SizedBox(height: 22),
                  const Text('NAYA JOB REQUEST',
                      style: TextStyle(
                          color: PColors.amber,
                          fontSize: 12,
                          letterSpacing: 2,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  Text(b.serviceName,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 26,
                          height: 1.15,
                          fontWeight: FontWeight.w900)),
                  const SizedBox(height: 6),
                  Text('${b.date} • ${b.slot}',
                      style: const TextStyle(
                          color: Colors.white54, fontSize: 12.5)),

                  const SizedBox(height: 22),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: .06),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white12),
                    ),
                    child: Column(
                      children: [
                        _row(Icons.location_on_outlined, b.address.oneLine),
                        const SizedBox(height: 10),
                        _row(Icons.person_outline,
                            'Customer ${b.phone.isEmpty ? '' : '+91 ${b.phone}'}'),
                        const SizedBox(height: 10),
                        _row(Icons.home_repair_service,
                            b.mode == 'instant' ? 'Instant booking' : 'Scheduled'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Expanded(
                        child: _amount(rupees(b.amount), 'Job value'),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _amount(rupees(earn), 'You earn (−10%)',
                            highlight: true),
                      ),
                    ],
                  ),
                  const Spacer(),

                  Row(
                    children: [
                      Expanded(
                        child: SizedBox(
                          height: 54,
                          child: OutlinedButton(
                            onPressed: () => _finish('rejected'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.white,
                              side: const BorderSide(color: Colors.white30),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14)),
                            ),
                            child: const Text('Reject',
                                style: TextStyle(
                                    fontWeight: FontWeight.w800, fontSize: 15)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        flex: 2,
                        child: SizedBox(
                          height: 54,
                          child: ElevatedButton.icon(
                            onPressed: () => _finish('accepted'),
                            icon: const Icon(Icons.check_circle, size: 20),
                            label: const Text('Accept Job',
                                style: TextStyle(
                                    fontWeight: FontWeight.w900, fontSize: 16)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: PColors.green,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(14)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                      '${JobAlertCenter.alertSeconds}s tak reply na dene par offer apne aap band ho jayega',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          color: Colors.white38, fontSize: 10.5)),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _row(IconData icon, String text) {
    return Row(
      children: [
        Icon(icon, size: 16, color: Colors.white54),
        const SizedBox(width: 8),
        Expanded(
          child: Text(text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: Colors.white, fontSize: 12.5)),
        ),
      ],
    );
  }

  Widget _amount(String value, String label, {bool highlight = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: (highlight ? PColors.green : Colors.white).withValues(alpha: .1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
            color: highlight
                ? PColors.green.withValues(alpha: .5)
                : Colors.white12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(color: Colors.white54, fontSize: 10.5)),
          const SizedBox(height: 2),
          Text(value,
              style: TextStyle(
                  color: highlight ? PColors.green : Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.w900)),
        ],
      ),
    );
  }
}
