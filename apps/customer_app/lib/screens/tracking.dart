/// Live dispatch tracking — searching → assigned → enroute → arrived →
library;
/// in progress → OTP confirm → completed, mirroring the web /track page.
import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';

class TrackScreen extends StatefulWidget {
  final String bookingId;
  const TrackScreen({super.key, required this.bookingId});

  @override
  State<TrackScreen> createState() => _TrackScreenState();
}

class _TrackScreenState extends State<TrackScreen> {
  BookingItem? _booking;
  SessionUser? _user;
  Timer? _poll;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  final _otp = TextEditingController();
  String? _otpError;
  int _rating = 0;
  DateTime? _startedAt;

  @override
  void initState() {
    super.initState();
    _init();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _otp.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    final user = await Api.restoreSession();
    if (!mounted) return;
    setState(() => _user = user);
    await _refresh();
    // poll while the booking is still live so the Pro's actions appear here
    _poll = Timer.periodic(const Duration(seconds: 4), (_) {
      if (_booking == null || _booking!.isLive) _refresh();
    });
  }

  Future<void> _refresh() async {
    final user = _user;
    if (user == null) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = 'Please log in again.';
        });
      }
      return;
    }
    try {
      final b = await Api.booking(user.id, widget.bookingId);
      if (!mounted) return;
      setState(() {
        _booking = b;
        _error = b == null ? 'Booking not found.' : null;
        if (b?.startedAt != null && _startedAt == null) {
          _startedAt = DateTime.fromMillisecondsSinceEpoch(b!.startedAt!);
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _patch(Map<String, dynamic> patch) async {
    final user = _user, b = _booking;
    if (user == null || b == null) return;
    setState(() => _busy = true);
    try {
      final updated = await Api.updateBooking(user.id, b.id, patch);
      if (!mounted) return;
      setState(() => _booking = updated);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<bool> _confirm(String title, String body) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: KColors.flame),
            child: const Text('Yes'),
          ),
        ],
      ),
    );
    return ok == true;
  }

  Future<void> _cancel() async {
    if (!await _confirm('Cancel booking?', 'The Professional will be notified immediately.')) {
      return;
    }
    await _patch({'status': 'cancelled'});
  }

  Future<void> _verifyOtp() async {
    final b = _booking;
    if (b == null) return;
    final entered = _otp.text.trim();
    if (entered.isEmpty) {
      setState(() => _otpError = 'Enter the OTP shown by your Professional');
      return;
    }
    final expected = b.completeOtp ?? '';
    if (expected.isNotEmpty && entered != expected) {
      setState(() => _otpError = 'That OTP does not match — please check again');
      return;
    }
    final user = _user, booking = _booking;
    if (user == null || booking == null) return;
    setState(() => _busy = true);
    try {
      final updated = await Api.updateBooking(
        user.id, booking.id, {'status': 'completed'}, completionOtp: entered);
      if (!mounted) return;
      setState(() {
        _booking = updated;
        _otpError = null;
        _otp.clear();
      });
    } catch (e) {
      if (mounted) setState(() => _otpError = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
    if (!mounted) return;
    setState(() {
      _otpError = null;
      _otp.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final b = _booking;
    return Scaffold(
      appBar: AppBar(
        title: Text(b == null ? 'Track Booking' : b.serviceName),
        actions: [
          IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: KColors.flame))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline, size: 42, color: KColors.red),
                        const SizedBox(height: 10),
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 14),
                        GhostBtn(label: 'Retry', onPressed: _refresh, color: KColors.flame),
                      ],
                    ),
                  ),
                )
              : b == null
                  ? const Center(child: Text('Booking not found'))
                  : RefreshIndicator(
                      onRefresh: _refresh,
                      child: ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          _statusCard(b),
                          const SizedBox(height: 14),
                          _providerCard(b),
                          const SizedBox(height: 14),
                          _stepper(b),
                          const SizedBox(height: 14),
                          _addressCard(b),
                          if (b.status == 'pending_confirm') ...[
                            const SizedBox(height: 14),
                            _otpCard(),
                          ],
                          if (b.status == 'completed') ...[
                            const SizedBox(height: 14),
                            _invoiceCard(b),
                            const SizedBox(height: 14),
                            _reviewCard(),
                          ],
                          const SizedBox(height: 90),
                        ],
                      ),
                    ),
      bottomNavigationBar: b == null || _loading
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: _actions(b),
              ),
            ),
    );
  }

  Widget _actions(BookingItem b) {
    if (b.isLive) {
      return Row(
        children: [
          Expanded(
            child: SizedBox(
              height: 50,
              child: OutlinedButton(
                onPressed: _busy ? null : _cancel,
                style: OutlinedButton.styleFrom(
                  foregroundColor: KColors.red,
                  side: BorderSide(color: KColors.red.withOpacity(.5)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Cancel Booking',
                    style: TextStyle(fontWeight: FontWeight.w700)),
              ),
            ),
          ),
        ],
      );
    }
    return GhostBtn(
      label: 'Back to Home',
      onPressed: () => Navigator.of(context).pop(),
      color: KColors.navy,
    );
  }

  Widget _statusCard(BookingItem b) {
    final searching = b.status == 'dispatched';
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: searching
              ? [KColors.blue, const Color(0xFF1D4ED8)]
              : [KColors.navy, const Color(0xFF173A6B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          if (searching) ...[
            const _Pulse(),
            const SizedBox(height: 14),
            const Text('Searching for nearby providers…',
                style: TextStyle(
                    color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900)),
            const SizedBox(height: 6),
            Text(
                b.dispatchRadiusKm > 0
                    ? '${b.dispatchRadiusKm} km ke andar ke professionals ko notification bheja gaya hai. Sabse pehle accept karne wale ko ye kaam milega.'
                    : 'Nearby professionals have been notified. First to accept gets your job.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white.withOpacity(.78), fontSize: 12.5)),
          ] else ...[
            Icon(
              b.status == 'completed'
                  ? Icons.check_circle
                  : b.status == 'cancelled'
                      ? Icons.cancel
                      : b.status == 'pending_confirm'
                          ? Icons.verified_user
                          : Icons.local_shipping,
              color: b.status == 'cancelled' ? KColors.red : KColors.flame,
              size: 46,
            ),
            const SizedBox(height: 10),
            Text(
              kStatusLabels[b.status] ?? b.status,
              style: const TextStyle(
                  color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 6),
            Text(
              kStatusActivity[b.status] ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withOpacity(.78), fontSize: 12.5),
            ),
            if (b.etaMinutes > 0 &&
                (b.status == 'accepted' || b.status == 'enroute')) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(.14),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text('Arriving in ~${b.etaMinutes} min',
                    style: const TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12.5)),
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _providerCard(BookingItem b) {
    final p = b.providerProfile;
    if (p == null) {
      return CardBox(
        child: Row(
          children: [
            const Icon(Icons.info_outline, color: KColors.blue),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'We are notifying verified professionals near you. You will see your Pro here the moment one accepts.',
                style: TextStyle(color: Colors.black54, fontSize: 12.5),
              ),
            ),
          ],
        ),
      );
    }
    return CardBox(
      child: Row(
        children: [
          CircleAvatar(
            radius: 26,
            backgroundColor: KColors.navy.withOpacity(.1),
            child: Text(p.name.isEmpty ? 'P' : p.name[0].toUpperCase(),
                style: const TextStyle(
                    fontWeight: FontWeight.w900, fontSize: 20, color: KColors.navy)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(p.name,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                const SizedBox(height: 2),
                Row(
                  children: [
                    const Icon(Icons.star, size: 14, color: KColors.amber),
                    Text(' ${p.rating.toStringAsFixed(1)}',
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 12.5)),
                    Text(' • ${p.jobs} jobs',
                        style: const TextStyle(color: Colors.black45, fontSize: 12)),
                  ],
                ),
                if (p.verified)
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text('Verified • Background checked',
                        style: TextStyle(color: KColors.green, fontSize: 11.5)),
                  ),
              ],
            ),
          ),
          IconButton(
            onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Calling is enabled after assignment')),
            ),
            icon: const Icon(Icons.call, color: KColors.green),
          ),
        ],
      ),
    );
  }

  Widget _stepper(BookingItem b) {
    const steps = ['Assigned', 'On Way', 'Arrived', 'Started', 'Completed'];
    int active = 0;
    if (b.status == 'accepted' || b.status == 'scheduled') active = 0;
    if (b.status == 'enroute') active = 1;
    if (b.status == 'arrived') active = 2;
    if (b.status == 'in_progress' || b.status == 'pending_confirm') active = 3;
    if (b.status == 'completed') active = 4;
    return CardBox(
      child: Row(
        children: steps.asMap().entries.map((e) {
          final done = e.key <= active;
          return Expanded(
            child: Column(
              children: [
                Row(
                  children: [
                    if (e.key > 0)
                      Expanded(
                          child: Container(
                              height: 2,
                              color: done ? KColors.flame : const Color(0xFFE2E8F0))),
                    Container(
                      height: 14,
                      width: 14,
                      decoration: BoxDecoration(
                        color: done ? KColors.flame : Colors.white,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: done ? KColors.flame : const Color(0xFFCBD5E1),
                            width: 2),
                      ),
                    ),
                    if (e.key < steps.length - 1)
                      Expanded(
                          child: Container(
                              height: 2,
                              color: e.key < active
                                  ? KColors.flame
                                  : const Color(0xFFE2E8F0))),
                  ],
                ),
                const SizedBox(height: 6),
                Text(e.value,
                    style: TextStyle(
                        fontSize: 9.5,
                        fontWeight: done ? FontWeight.w800 : FontWeight.w500,
                        color: done ? KColors.navy : Colors.black38)),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _addressCard(BookingItem b) {
    return CardBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Service Address',
              style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
          const SizedBox(height: 6),
          Text(b.address.oneLine,
              style: const TextStyle(color: Colors.black54, fontSize: 12.5)),
          const Divider(height: 22),
          Row(
            children: [
              const Icon(Icons.event, size: 16, color: Colors.black45),
              const SizedBox(width: 6),
              Text('${b.date} • ${b.slot}',
                  style: const TextStyle(fontSize: 12.5, color: Colors.black54)),
              const Spacer(),
              StatusChip(status: b.status),
            ],
          ),
          if (b.notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('Note: ${b.notes}',
                style: const TextStyle(fontSize: 12, color: Colors.black45)),
          ],
        ],
      ),
    );
  }

  Widget _otpCard() {
    return CardBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Verify & Complete',
              style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
          const SizedBox(height: 6),
          const Text('Ask your Professional for the completion OTP.',
              style: TextStyle(color: Colors.black54, fontSize: 12.5)),
          const SizedBox(height: 12),
          TextField(
            controller: _otp,
            keyboardType: TextInputType.number,
            maxLength: 6,
            style: const TextStyle(
                fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: 10),
            decoration: InputDecoration(
              counterText: '',
              hintText: '••••',
              errorText: _otpError,
            ),
          ),
          const SizedBox(height: 10),
          PrimaryBtn(label: 'Confirm & Complete', busy: _busy, onPressed: _verifyOtp),
        ],
      ),
    );
  }

  Widget _invoiceCard(BookingItem b) {
    return CardBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('Invoice',
                  style: TextStyle(fontWeight: FontWeight.w900, color: KColors.navy)),
              const Spacer(),
              Text('#${b.id}', style: const TextStyle(color: Colors.black45, fontSize: 11)),
            ],
          ),
          const Divider(height: 22),
          _row(b.serviceName, rupees(b.amount)),
          const SizedBox(height: 6),
          const _Row2('Visiting / diagnosis', '₹0'),
          const SizedBox(height: 6),
          const _Row2('Additional work', '₹0'),
          const Divider(height: 22),
          _row('Total Amount', rupees(b.amount), bold: true),
        ],
      ),
    );
  }

  Widget _row(String label, String value, {bool bold = false}) {
    return Row(
      children: [
        Expanded(
            child: Text(label,
                style: TextStyle(
                    fontWeight: bold ? FontWeight.w800 : FontWeight.w600, fontSize: 13))),
        Text(value,
            style: TextStyle(
                fontWeight: bold ? FontWeight.w900 : FontWeight.w700,
                color: bold ? KColors.navy : Colors.black87)),
      ],
    );
  }

  Widget _reviewCard() {
    return CardBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Rate Your Experience',
              style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
          const SizedBox(height: 8),
          Row(
            children: List.generate(5, (i) {
              return IconButton(
                onPressed: () => setState(() => _rating = i + 1),
                icon: Icon(i < _rating ? Icons.star : Icons.star_border,
                    color: KColors.amber, size: 30),
              );
            }),
          ),
          PrimaryBtn(
            label: 'Submit Review',
            onPressed: _rating == 0
                ? null
                : () {
                    ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Thanks for your feedback!')));
                    setState(() => _rating = 0);
                  },
          ),
        ],
      ),
    );
  }
}

const kStatusActivity = <String, String>{
  'accepted': 'Your Professional has accepted the job and will start shortly.',
  'scheduled': 'Your booking is scheduled. We will remind you before the slot.',
  'enroute': 'Your Professional is on the way to your location.',
  'arrived': 'Your Professional has arrived at your location.',
  'in_progress': 'Work is in progress at your location.',
  'pending_confirm': 'Work finished — verify the OTP to close the job.',
  'completed': 'Your service has been completed successfully.',
  'cancelled': 'This booking was cancelled.',
};

class _Row2 extends StatelessWidget {
  final String label, value;
  const _Row2(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(label,
                style: const TextStyle(fontSize: 12.5, color: Colors.black54))),
        Text(value,
            style: const TextStyle(fontSize: 12.5, color: Colors.black54)),
      ],
    );
  }
}

/// Expanding ring used while the request is being dispatched.
class _Pulse extends StatefulWidget {
  const _Pulse();

  @override
  State<_Pulse> createState() => _PulseState();
}

class _PulseState extends State<_Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))
        ..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 76,
      width: 76,
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                height: 76 * _c.value,
                width: 76 * _c.value,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                      color: Colors.white.withOpacity(1 - _c.value), width: 2),
                ),
              ),
              Container(
                height: 40,
                width: 40,
                decoration: const BoxDecoration(
                    color: Colors.white24, shape: BoxShape.circle),
                child: const Icon(Icons.search, color: Colors.white, size: 22),
              ),
            ],
          );
        },
      ),
    );
  }
}
