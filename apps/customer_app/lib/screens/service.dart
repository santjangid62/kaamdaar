/// Service detail (Overview / Pricing / FAQ tabs) → booking review → dispatch.
library;
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'home.dart' show iconFor;
import 'tracking.dart';

class ServiceDetailScreen extends StatefulWidget {
  final ServiceItem service;
  const ServiceDetailScreen({super.key, required this.service});

  @override
  State<ServiceDetailScreen> createState() => _ServiceDetailScreenState();
}

class _ServiceDetailScreenState extends State<ServiceDetailScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final s = widget.service;
    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            expandedHeight: 190,
            pinned: true,
            backgroundColor: KColors.navy,
            foregroundColor: Colors.white,
            flexibleSpace: FlexibleSpaceBar(
              background: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                      colors: [KColors.navy, Color(0xFF1B4179)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight),
                ),
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                        color: Colors.white.withOpacity(.12), shape: BoxShape.circle),
                    child: Icon(iconFor(s.icon.isEmpty ? s.category : s.icon),
                        color: KColors.flame, size: 56),
                  ),
                ),
              ),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(s.name,
                      style: const TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w900, color: KColors.navy)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.star, color: KColors.amber, size: 18),
                      const SizedBox(width: 4),
                      const Text('4.8', style: TextStyle(fontWeight: FontWeight.w800)),
                      const Text(' (2.5K reviews)',
                          style: TextStyle(color: Colors.black45, fontSize: 13)),
                      const Spacer(),
                      Text('${rupees(s.price)} onwards',
                          style: const TextStyle(
                              fontWeight: FontWeight.w900, color: KColors.flame, fontSize: 16)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: const [
                      _Badge(icon: Icons.verified, label: 'Verified Experts'),
                      _Badge(icon: Icons.currency_rupee, label: 'Transparent Pricing'),
                      _Badge(icon: Icons.workspace_premium, label: 'Warranty on Service'),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: ['Overview', 'Pricing', 'FAQ'].asMap().entries.map((e) {
                      final active = _tab == e.key;
                      return Padding(
                        padding: const EdgeInsets.only(right: 10),
                        child: InkWell(
                          onTap: () => setState(() => _tab = e.key),
                          borderRadius: BorderRadius.circular(10),
                          child: Container(
                            padding:
                                const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                            decoration: BoxDecoration(
                              color: active ? KColors.navy : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                  color: active ? KColors.navy : const Color(0xFFE2E8F0)),
                            ),
                            child: Text(e.value,
                                style: TextStyle(
                                    color: active ? Colors.white : Colors.black54,
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13.5)),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),
                  if (_tab == 0) ...[
                    if (s.description.isNotEmpty) ...[
                      Text(s.description,
                          style: const TextStyle(height: 1.5, color: Colors.black87)),
                      const SizedBox(height: 14),
                    ],
                    const Text('What’s included',
                        style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
                    const SizedBox(height: 8),
                    ...(s.includes.isEmpty
                        ? <Widget>[
                            const Text('Standard service as per category norms',
                                style: TextStyle(color: Colors.black54))
                          ]
                        : s.includes.map((i) => Row(
                              children: [
                                const Icon(Icons.check_circle, color: KColors.green, size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                    child:
                                        Text(i, style: const TextStyle(fontSize: 14))),
                              ],
                            ))),
                    if (s.excludes.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      const Text('Not included',
                          style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
                      const SizedBox(height: 8),
                      ...s.excludes.map((i) => Row(
                            children: [
                              const Icon(Icons.cancel, color: KColors.red, size: 18),
                              const SizedBox(width: 8),
                              Expanded(child: Text(i, style: const TextStyle(fontSize: 14))),
                            ],
                          )),
                    ],
                    const SizedBox(height: 12),
                    Row(children: [
                      const Icon(Icons.schedule, size: 16, color: Colors.black45),
                      const SizedBox(width: 6),
                      Text(s.duration.isEmpty ? 'As per requirement' : s.duration,
                          style: const TextStyle(color: Colors.black54, fontSize: 13.5)),
                    ]),
                  ] else if (_tab == 1) ...[
                    CardBox(
                      child: Column(
                        children: [
                          _PriceRow(s.name, rupees(s.price), s.unit),
                          const Divider(height: 24),
                          const _PriceRow('Visit / diagnosis', '₹0', 'free'),
                          const Divider(height: 24),
                          const _PriceRow('Additional work', 'As quoted', 'before start'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text('Final price is confirmed by the Professional before work begins.',
                        style: TextStyle(color: Colors.black54, fontSize: 12.5)),
                  ] else ...[
                    const _Faq(
                        q: 'How quickly will a Professional reach me?',
                        a: 'Most bookings are assigned within a few minutes and Pros reach in about 30 minutes, depending on your area.'),
                    const _Faq(
                        q: 'Is the service guaranteed?',
                        a: 'Yes — every service carries a workmanship warranty. If an issue reappears, we re-visit free of cost.'),
                    const _Faq(
                        q: 'When do I pay?',
                        a: 'After the service is completed. Pay by UPI or cash directly to the Professional.'),
                  ],
                  const SizedBox(height: 90),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Container(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          decoration: BoxDecoration(
              color: Colors.white,
              border: const Border(top: BorderSide(color: Color(0xFFE2E8F0)))),
          child: PrimaryBtn(
            label: 'Book Now • ${rupees(s.price)}',
            icon: Icons.arrow_forward,
            onPressed: () async {
              await Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => BookingScreen(service: s)));
            },
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final IconData icon;
  final String label;
  const _Badge({required this.icon, required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: KColors.green.withOpacity(.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: KColors.green),
        const SizedBox(width: 4),
        Text(label,
            style: const TextStyle(
                fontSize: 11.5, color: KColors.green, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

class _PriceRow extends StatelessWidget {
  final String label, amount, unit;
  const _PriceRow(this.label, this.amount, this.unit);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600))),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(amount, style: const TextStyle(fontWeight: FontWeight.w900)),
            Text(unit, style: const TextStyle(fontSize: 11, color: Colors.black45)),
          ],
        ),
      ],
    );
  }
}

class _Faq extends StatelessWidget {
  final String q, a;
  const _Faq({required this.q, required this.a});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(q, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 6),
          Text(a, style: const TextStyle(color: Colors.black54, fontSize: 13, height: 1.45)),
        ],
      ),
    );
  }
}

/* --------------------------- booking review --------------------------- */

class BookingScreen extends StatefulWidget {
  final ServiceItem service;
  const BookingScreen({super.key, required this.service});

  @override
  State<BookingScreen> createState() => _BookingScreenState();
}

class _BookingScreenState extends State<BookingScreen> {
  List<AddressItem> _addresses = [];
  AddressItem? _picked;
  SessionUser? _user;
  final _notes = TextEditingController();
  String _slot = 'ASAP';
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user = await Api.restoreSession();
      if (user == null) {
        setState(() {
          _loading = false;
          _error = 'Please log in to book a service.';
        });
        return;
      }
      final addrs = await Api.addresses(user.id);
      if (!mounted) return;
      setState(() {
        _user = user;
        _addresses = addrs;
        _picked = addrs.cast<AddressItem?>().firstWhere(
              (a) => a!.isDefault,
              orElse: () => addrs.isEmpty ? null : addrs.first,
            );
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _loading = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<void> _confirm() async {
    final user = _user;
    final addr = _picked;
    if (user == null || addr == null) {
      setState(() => _error = 'Select or add an address first.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      // The backend works out who can serve this near the address (3 km,
      // widening to 5 km), notifies every one of them and the first accept
      // wins — the app never picks or ranks Pros itself.
      // Never substitute a hard-coded Jaipur coordinate: it can dispatch a
      // real job to professionals around the wrong address. The backend will
      // validate the saved address pin before creating the booking.
      final lat = addr.lat;
      final lng = addr.lng;
      if (lat == null || lng == null ||
          !lat.isFinite || !lng.isFinite ||
          lat.abs() > 90 || lng.abs() > 180) {
        setState(() {
          _busy = false;
          _error = 'Is address ka map location save nahi hai. Map pin ke saath address update karke dobara booking karein.';
        });
        return;
      }
      final booking = await Api.createBooking({
        'userId': user.id,
        'phone': user.phone,
        'serviceId': widget.service.id,
        'serviceName': widget.service.name,
        'providerId': '',
        'providerName': '',
        'address': addr.toJson(),
        'mode': _slot == 'ASAP' ? 'instant' : 'scheduled',
        'date': DateTime.now().toIso8601String().split('T').first,
        'slot': _slot,
        'amount': widget.service.price,
        'status': 'dispatched',
        'createdAt': DateTime.now().millisecondsSinceEpoch,
        'dispatchedAt': DateTime.now().millisecondsSinceEpoch,
        'originPoint': {'lat': lat, 'lng': lng},
        'notes': _notes.text.trim(),
      });
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => TrackScreen(bookingId: booking.id)));
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addAddress() async {
    final user = _user;
    if (user == null) return;
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Address'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Save this address while you are physically at the service location so we can pin it accurately.'),
            const SizedBox(height: 12),
            TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: const InputDecoration(hintText: 'House no, Street, Area, City'),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: KColors.flame),
              child: const Text('Save')),
        ],
      ),
    );
    if (ok != true || ctrl.text.trim().isEmpty) return;
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        throw Exception('Address map pin save karne ke liye location permission dein.');
      }
      if (!await Geolocator.isLocationServiceEnabled()) {
        throw Exception('GPS on karein aur address save dobara karein.');
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 10),
        ),
      );
      final parts = ctrl.text.split(',').map((e) => e.trim()).toList();
      await Api.addAddress(user.id, {
        'label': 'Home',
        'line1': parts.first,
        if (parts.length > 1) 'line2': parts.sublist(1).join(', '),
        'city': 'Jaipur',
        'pincode': '302017',
        'lat': position.latitude,
        'lng': position.longitude,
      });
      await _load();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.service;
    return Scaffold(
      appBar: AppBar(title: const Text('Review Your Booking')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: KColors.flame))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                CardBox(
                  child: Row(
                    children: [
                      Container(
                        height: 46,
                        width: 46,
                        decoration: BoxDecoration(
                            color: KColors.flame.withOpacity(.12),
                            borderRadius: BorderRadius.circular(12)),
                        child: Icon(iconFor(s.icon.isEmpty ? s.category : s.icon),
                            color: KColors.flame),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(s.name,
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 15.5)),
                      ),
                      Text(rupees(s.price),
                          style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              color: KColors.flame,
                              fontSize: 16)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                const Text('Date & Time',
                    style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  children: ['ASAP', '10:00 AM - 12:00 PM', '02:00 PM - 04:00 PM', '05:00 PM - 07:00 PM']
                      .map((t) => ChoiceChip(
                            label: Text(t),
                            selected: _slot == t,
                            selectedColor: KColors.flame.withOpacity(.2),
                            onSelected: (_) => setState(() => _slot = t),
                          ))
                      .toList(),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Text('Address',
                        style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
                    const Spacer(),
                    TextButton(
                        onPressed: _addAddress,
                        child: const Text('+ Add New',
                            style: TextStyle(color: KColors.blue))),
                  ],
                ),
                if (_addresses.isEmpty)
                  const CardBox(
                      child: Text('No saved addresses. Tap “+ Add New” to add one.',
                          style: TextStyle(color: Colors.black54)))
                else
                  ..._addresses.map((a) => Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: CardBox(
                          onTap: () => setState(() => _picked = a),
                          child: Row(
                            children: [
                              Icon(
                                  _picked?.id == a.id
                                      ? Icons.radio_button_checked
                                      : Icons.radio_button_off,
                                  color: KColors.flame),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(a.label,
                                        style: const TextStyle(
                                            fontWeight: FontWeight.w800, fontSize: 14)),
                                    Text(a.oneLine,
                                        style: const TextStyle(
                                            color: Colors.black54, fontSize: 12.5)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      )),
                const SizedBox(height: 8),
                const Text('Notes for provider',
                    style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
                const SizedBox(height: 8),
                TextField(
                  controller: _notes,
                  maxLines: 3,
                  decoration:
                      const InputDecoration(hintText: 'e.g. AC not cooling properly'),
                ),
                const SizedBox(height: 16),
                CardBox(
                  child: Row(
                    children: [
                      const Text('Total Amount',
                          style: TextStyle(fontWeight: FontWeight.w800)),
                      const Spacer(),
                      Text(rupees(s.price),
                          style: const TextStyle(
                              fontWeight: FontWeight.w900,
                              fontSize: 18,
                              color: KColors.navy)),
                    ],
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!, style: const TextStyle(color: KColors.red, fontSize: 13)),
                ],
                const SizedBox(height: 16),
                PrimaryBtn(
                    label: 'Confirm Booking', busy: _busy, onPressed: _confirm),
                const SizedBox(height: 24),
              ],
            ),
    );
  }
}