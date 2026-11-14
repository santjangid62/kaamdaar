/// Job lifecycle: navigate → arrived → start OTP → in progress →
/// work completed (completion OTP) → payment received (10% commission).
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';

class JobDetailScreen extends StatefulWidget {
  final String bookingId;
  final ProviderItem? provider;
  const JobDetailScreen({super.key, required this.bookingId, this.provider});

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  BookingItem? _booking;
  ProviderItem? _me;
  Timer? _poll;
  Timer? _gpsTimer;
  bool _loading = true;
  bool _busy = false;
  String? _error;
  final _otp = TextEditingController();
  final _completionOtp = TextEditingController();
  String? _otpError;

  @override
  void initState() {
    super.initState();
    _me = widget.provider;
    _init();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _gpsTimer?.cancel();
    _otp.dispose();
    _completionOtp.dispose();
    super.dispose();
  }

  Future<void> _init() async {
    final user = await Api.restoreSession();
    if (user == null) {
      if (mounted) setState(() => _loading = false);
      return;
    }
    _me ??= await Api.me(user.phone);
    await _refresh();
    _poll = Timer.periodic(const Duration(seconds: 4), (_) {
      final b = _booking;
      if (b != null && b.status != 'completed' && b.status != 'cancelled') _refresh();
    });
  }

  Future<void> _refresh() async {
    final me = _me;
    if (me == null) return;
    try {
      final jobs = await Api.inbox(me.id);
      final found = jobs.where((b) => b.id == widget.bookingId).toList();
      if (!mounted) return;
      setState(() {
        _booking = found.isEmpty ? null : found.first;
        _error = found.isEmpty ? 'This job is no longer assigned to you.' : null;
      });
      if (_booking?.status == 'enroute') {
        _startLiveGps();
      } else {
        _gpsTimer?.cancel();
        _gpsTimer = null;
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _startLiveGps() {
    if (_gpsTimer != null) return;
    // Send a fresh point every 8 seconds while travelling. The server stamps
    // each ping and shares the same point with the customer and admin maps.
    _gpsTimer = Timer.periodic(const Duration(seconds: 8), (_) => _sendGpsPing());
    _sendGpsPing();
  }

  Future<void> _sendGpsPing() async {
    final b = _booking;
    if (b == null || b.status != 'enroute' || _busy) return;
    try {
      if (!await Geolocator.isLocationServiceEnabled()) return;
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) return;
      final point = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 8),
        ),
      );
      await Api.updateJob(b.id, {
        'providerPing': {
          'lat': point.latitude,
          'lng': point.longitude,
          'accuracy': point.accuracy,
        },
      });
    } catch (_) {
      // A transient GPS/network failure must not stop the journey timer.
    }
  }

  Future<void> _openCustomerMap(BookingItem booking) async {
    final lat = booking.customerLat;
    final lng = booking.customerLng;
    if (lat == null || lng == null ||
        !lat.isFinite || !lng.isFinite ||
        lat.abs() > 90 || lng.abs() > 180) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Customer ka map pin available nahi hai.')),
        );
      }
      return;
    }
    final uri = Uri.https('www.google.com', '/maps/dir/', {
      'api': '1',
      'destination': '$lat,$lng',
      'travelmode': 'driving',
    });
    final opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Google Maps open nahi ho paya.')),
      );
    }
  }

  Future<void> _patch(Map<String, dynamic> changes) async {
    final b = _booking;
    if (b == null) return;
    setState(() => _busy = true);
    try {
      final updated = await Api.updateJob(b.id, changes);
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

  Future<void> _startOtp() async {
    final b = _booking;
    if (b == null) return;
    final entered = _otp.text.trim();
    if (entered.isEmpty) {
      setState(() => _otpError = 'Customer se OTP lein');
      return;
    }
    final expected = b.startOtp ?? '';
    if (expected.isNotEmpty && entered != expected) {
      setState(() => _otpError = 'OTP galat hai — customer se dobara poochein');
      return;
    }
    setState(() => _otpError = null);
    await _patch({
      'status': 'in_progress',
      'startOtp': entered,
    });
  }

  Future<void> _completeWork() async {
    await _patch({'status': 'pending_confirm'});
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Customer ko completion OTP bhej diya gaya hai. OTP lekar yahan verify karein.')),
    );
  }

  Future<void> _verifyCompletionOtp() async {
    final b = _booking;
    final entered = _completionOtp.text.trim();
    if (b == null || entered.length != 6) return;
    setState(() => _busy = true);
    try {
      final updated = await Api.updateJob(b.id, {'status': 'completed'},
          completionOtp: entered);
      if (!mounted) return;
      setState(() {
        _booking = updated;
        _completionOtp.clear();
        _otpError = null;
      });
    } catch (e) {
      if (mounted) setState(() => _otpError = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancelJob() async {
    final b = _booking;
    if (b == null) return;
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel this job?'),
        content: TextField(controller: controller, maxLines: 3, decoration: const InputDecoration(labelText: 'Cancellation reason (required)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Keep job')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: PColors.red),
            onPressed: () => Navigator.pop(ctx, controller.text.trim()),
            child: const Text('Confirm cancellation'),
          ),
        ],
      ),
    );
    controller.dispose();
    if (reason == null || reason.trim().length < 3) return;
    await _patch({'status': 'cancelled', 'cancellationReason': reason.trim()});
    await _refresh();
  }

  Widget _cancelAction(BookingItem b) {
    return OutlinedButton.icon(
      onPressed: _busy ? null : _cancelJob,
      icon: const Icon(Icons.cancel_outlined, color: PColors.red),
      label: const Text('Cancel job (reason required)', style: TextStyle(color: PColors.red)),
      style: OutlinedButton.styleFrom(side: const BorderSide(color: PColors.red)),
    );
  }

  Future<void> _takePayment() async {
    final b = _booking;
    final me = _me;
    if (b == null || me == null) return;
    final method = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Payment received',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900)),
            ),
            ListTile(
              leading: const Icon(Icons.payments_outlined, color: PColors.green),
              title: Text('Cash — ${rupees(b.amount)}'),
              onTap: () => Navigator.pop(ctx, 'cash'),
            ),
            ListTile(
              leading: const Icon(Icons.qr_code_2, color: PColors.blue),
              title: Text('UPI / PhonePe — ${rupees(b.amount)}'),
              onTap: () => Navigator.pop(ctx, 'upi'),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
    if (method == null) return;
    String reference = '';
    if (method == 'upi') {
      final controller = TextEditingController();
      final entered = await showDialog<String>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('UPI transaction reference'),
          content: TextField(controller: controller, autofocus: true, decoration: const InputDecoration(labelText: 'UTR / Transaction ID')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, controller.text.trim()), child: const Text('Continue')),
          ],
        ),
      );
      controller.dispose();
      if (entered == null || entered.length < 6) return;
      reference = entered;
    }
    setState(() => _busy = true);
    try {
      await _patch({
        'paymentReported': true,
        'paymentMethod': method,
        'paymentReference': reference,
      });
      await _refresh();
      if (!mounted) return;
      if (_booking?.paymentStatus == 'reported') {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Payment report Admin ko bhej di gayi hai. Verification pending hai.')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final b = _booking;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Job Details'),
        actions: [
          IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: PColors.green))
          : b == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error ?? 'Job not found',
                        textAlign: TextAlign.center),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _refresh,
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      _header(b),
                      const SizedBox(height: 14),
                      _customerCard(b),
                      const SizedBox(height: 14),
                      _addressCard(b),
                      if (b.status == 'arrived') ...[
                        const SizedBox(height: 14),
                        _otpCard(),
                      ],
                      if (b.status == 'pending_confirm') ...[
                        const SizedBox(height: 14),
                        _waitingCard(b),
                      ],
                      if (b.status == 'completed') ...[
                        const SizedBox(height: 14),
                        _invoiceCard(b),
                      ],
                      const SizedBox(height: 16),
                      _primaryAction(b),
                      if (['accepted', 'scheduled', 'enroute', 'arrived'].contains(b.status)) ...[
                        const SizedBox(height: 8),
                        _cancelAction(b),
                      ],
                      const SizedBox(height: 24),
                    ],
                  ),
                ),
    );
  }

  Widget _header(BookingItem b) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [jobStatusColor(b.status), jobStatusColor(b.status).withValues(alpha: .8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(jobStatusLabels[b.status] ?? b.status,
              style: const TextStyle(
                  color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(b.serviceName,
              style: TextStyle(
                  color: Colors.white.withValues(alpha: .85), fontSize: 13)),
          const SizedBox(height: 12),
          Row(
            children: [
              _pill('Amount', rupees(b.amount)),
              const SizedBox(width: 8),
              _pill('You get', rupees(b.amount - commissionOf(b.amount))),
              const SizedBox(width: 8),
              _pill('Slot', b.slot),
            ],
          ),
        ],
      ),
    );
  }

  Widget _pill(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: .18),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        children: [
          Text('$label ',
              style: TextStyle(
                  color: Colors.white.withValues(alpha: .8), fontSize: 10.5)),
          Text(value,
              style: const TextStyle(
                  color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }

  Widget _customerCard(BookingItem b) {
    return CardBox(
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: PColors.ink.withValues(alpha: .08),
            child: const Icon(Icons.person, color: PColors.ink, size: 20),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(b.phone.isEmpty ? 'Customer' : '+91 ${b.phone}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: 14)),
                Text('Booking #${b.id}',
                    style: const TextStyle(fontSize: 11, color: Colors.black38)),
              ],
            ),
          ),
          IconButton(
            onPressed: () => Clipboard.setData(ClipboardData(text: b.phone)),
            icon: const Icon(Icons.copy, size: 18, color: Colors.black45),
          ),
        ],
      ),
    );
  }

  Widget _addressCard(BookingItem b) {
    return CardBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.location_on, size: 16, color: PColors.green),
              const SizedBox(width: 6),
              const Text('Service Address',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
              const Spacer(),
              StatusChip(status: b.status),
            ],
          ),
          const SizedBox(height: 8),
          Text(b.address.oneLine,
              style: const TextStyle(fontSize: 12.5, color: Colors.black54)),
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: () => _openCustomerMap(b),
              icon: const Icon(Icons.map_outlined, size: 18),
              label: const Text('View customer location / Navigate'),
            ),
          ),
          const SizedBox(height: 6),
          Text('${b.date} • ${b.slot}',
              style: const TextStyle(fontSize: 12, color: Colors.black45)),
          if (b.notes.isNotEmpty) ...[
            const Divider(height: 20),
            Text('Customer note: ${b.notes}',
                style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ],
      ),
    );
  }

  Widget _otpCard() {
    return CardBox(
      borderColor: PColors.green.withValues(alpha: .45),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Enter Customer OTP',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
          const SizedBox(height: 4),
          const Text('Kaam shuru karne se pehle customer se OTP lein.',
              style: TextStyle(fontSize: 11.5, color: Colors.black45)),
          const SizedBox(height: 10),
          TextField(
            controller: _otp,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: 10),
            decoration: InputDecoration(counterText: '', errorText: _otpError),
          ),
        ],
      ),
    );
  }

  Widget _waitingCard(BookingItem b) {
    return CardBox(
      borderColor: PColors.amber.withValues(alpha: .6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Enter customer completion OTP',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
          const SizedBox(height: 6),
          const Text('Customer ko app par mila OTP lein aur yahan enter karein.',
              style: TextStyle(fontSize: 11.5, color: Colors.black54)),
          const SizedBox(height: 10),
          TextField(
            controller: _completionOtp,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900, letterSpacing: 8),
            decoration: InputDecoration(counterText: '', errorText: _otpError),
          ),
          PrimaryBtn(
            label: 'Verify & Close Job',
            busy: _busy,
            onPressed: _completionOtp.text.trim().length == 6 ? _verifyCompletionOtp : null,
          ),
        ],
      ),
    );
  }

  Widget _invoiceCard(BookingItem b) {
    final paid = b.paymentStatus == 'verified' || b.paidAt != null;
    final reported = b.paymentStatus == 'reported';
    return CardBox(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text('Invoice',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13.5)),
              const Spacer(),
              Text(paid ? 'VERIFIED' : reported ? 'ADMIN REVIEW' : b.paymentStatus == 'disputed' ? 'DISPUTED' : 'PENDING PAYMENT',
                  style: TextStyle(
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      color: paid ? PColors.green : PColors.blue)),
            ],
          ),
          const Divider(height: 20),
          _row(b.serviceName, rupees(b.amount)),
          const SizedBox(height: 4),
          _row('Commission (10%)', '− ${rupees(commissionOf(b.amount))}'),
          const Divider(height: 20),
          _row('You receive', rupees(b.amount - commissionOf(b.amount)), bold: true),
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
                    fontSize: bold ? 13.5 : 12.5,
                    fontWeight: bold ? FontWeight.w800 : FontWeight.w500))),
        Text(value,
            style: TextStyle(
                fontSize: bold ? 14 : 12.5,
                fontWeight: bold ? FontWeight.w900 : FontWeight.w700,
                color: bold ? PColors.green : Colors.black87)),
      ],
    );
  }

  Widget _primaryAction(BookingItem b) {
    switch (b.status) {
      case 'accepted':
      case 'scheduled':
        return PrimaryBtn(
          label: 'Start Navigation',
          icon: Icons.navigation,
          busy: _busy,
          onPressed: () async {
            await _patch({'navigationStarted': true, 'status': 'enroute'});
            if (_booking?.status == 'enroute') {
              _startLiveGps();
              await _openCustomerMap(_booking!);
            }
          },
        );
      case 'enroute':
        return PrimaryBtn(
          label: 'I Have Arrived',
          icon: Icons.location_on,
          busy: _busy,
          onPressed: () => _patch({
            'status': 'arrived',
            'arrivedAt': DateTime.now().millisecondsSinceEpoch,
          }),
        );
      case 'arrived':
        return PrimaryBtn(
          label: 'Start Service',
          icon: Icons.play_arrow,
          busy: _busy,
          onPressed: _startOtp,
        );
      case 'in_progress':
        return Column(
          children: [
            PrimaryBtn(
              label: 'Work Completed',
              icon: Icons.check_circle_outline,
              busy: _busy,
              onPressed: _completeWork,
            ),
            const SizedBox(height: 8),
            const Text('Customer ko completion OTP dikhega — verify karte hi payment lega.',
                style: TextStyle(fontSize: 11, color: Colors.black45)),
          ],
        );
      case 'pending_confirm':
        return const SizedBox.shrink();
      case 'completed':
        if (b.paymentStatus == 'reported') {
          return const CardBox(child: Text('Payment report sent. Admin verification is pending.', style: TextStyle(color: PColors.blue, fontSize: 12.5)));
        }
        if (b.paymentStatus == 'disputed') {
          return const CardBox(child: Text('Payment report is disputed. Please contact Admin.', style: TextStyle(color: PColors.red, fontSize: 12.5)));
        }
        if (b.paidAt != null || b.paymentStatus == 'verified') {
          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: PColors.green.withValues(alpha: .1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle, color: PColors.green),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Payment ${b.paymentMethod == 'upi' ? 'via UPI' : 'in cash'} recorded — job closed.',
                    style: const TextStyle(fontSize: 12.5, color: PColors.greenDark),
                  ),
                ),
              ],
            ),
          );
        }
        return PrimaryBtn(
          label: 'Payment Received',
          icon: Icons.payments,
          busy: _busy,
          onPressed: _takePayment,
        );
      case 'cancelled':
        return Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: PColors.red.withValues(alpha: .08),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Text('This booking was cancelled by ${b.cancelledBy ?? "customer"}. ${b.cancellationReason ?? ""}',
              style: const TextStyle(fontSize: 12.5, color: PColors.red)),
        );
      default:
        return const SizedBox.shrink();
    }
  }
}
