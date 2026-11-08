/// Booking history — All / Upcoming / Completed, from the backend.
library;
import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'tracking.dart';

class BookingsScreen extends StatefulWidget {
  const BookingsScreen({super.key});

  @override
  State<BookingsScreen> createState() => _BookingsScreenState();
}

class _BookingsScreenState extends State<BookingsScreen> {
  int _tab = 0;
  List<BookingItem> _all = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = await Api.restoreSession();
      if (user == null) {
        setState(() {
          _loading = false;
          _error = 'Please log in to see your bookings.';
        });
        return;
      }
      final list = await Api.userBookings(user.id);
      if (!mounted) return;
      setState(() {
        _all = list;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<BookingItem> get _view {
    if (_tab == 1) return _all.where((b) => b.isLive).toList();
    if (_tab == 2) return _all.where((b) => !b.isLive).toList();
    return _all;
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 6),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('Booking History',
                  style: TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w900, color: KColors.navy)),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: ['All', 'Upcoming', 'Completed'].asMap().entries.map((e) {
                final active = _tab == e.key;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(e.value),
                    selected: active,
                    selectedColor: KColors.navy,
                    labelStyle: TextStyle(
                        color: active ? Colors.white : Colors.black54,
                        fontWeight: FontWeight.w700,
                        fontSize: 12.5),
                    onSelected: (_) => setState(() => _tab = e.key),
                  ),
                );
              }).toList(),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: KColors.flame))
                  : _error != null
                      ? ListView(
                          padding: const EdgeInsets.all(24),
                          children: [
                            const SizedBox(height: 60),
                            const Icon(Icons.receipt_long, size: 44, color: Colors.black26),
                            const SizedBox(height: 10),
                            Text(_error!, textAlign: TextAlign.center),
                            const SizedBox(height: 14),
                            GhostBtn(label: 'Retry', onPressed: _load, color: KColors.flame),
                          ],
                        )
                      : _view.isEmpty
                          ? ListView(
                              padding: const EdgeInsets.all(24),
                              children: const [
                                SizedBox(height: 70),
                                Icon(Icons.inbox_outlined, size: 48, color: Colors.black26),
                                SizedBox(height: 10),
                                Center(
                                    child: Text('No bookings here yet',
                                        style: TextStyle(color: Colors.black45))),
                              ],
                            )
                          : ListView(
                              padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                              children: _view
                                  .map((b) => Padding(
                                        padding: const EdgeInsets.only(bottom: 10),
                                        child: CardBox(
                                          onTap: () async {
                                            await Navigator.of(context).push(
                                                MaterialPageRoute(
                                                    builder: (_) =>
                                                        TrackScreen(bookingId: b.id)));
                                            _load();
                                          },
                                          child: Column(
                                            children: [
                                              Row(
                                                children: [
                                                  Container(
                                                    height: 44,
                                                    width: 44,
                                                    decoration: BoxDecoration(
                                                      color: KColors.navy.withOpacity(.08),
                                                      borderRadius:
                                                          BorderRadius.circular(12),
                                                    ),
                                                    child: const Icon(Icons.receipt_long,
                                                        color: KColors.navy, size: 20),
                                                  ),
                                                  const SizedBox(width: 12),
                                                  Expanded(
                                                    child: Column(
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment.start,
                                                      children: [
                                                        Text(b.serviceName,
                                                            style: const TextStyle(
                                                                fontWeight:
                                                                    FontWeight.w800,
                                                                fontSize: 14.5)),
                                                        Text(
                                                            '${b.date} • ${b.slot}',
                                                            style: const TextStyle(
                                                                color: Colors.black54,
                                                                fontSize: 12)),
                                                      ],
                                                    ),
                                                  ),
                                                  Text(rupees(b.amount),
                                                      style: const TextStyle(
                                                          fontWeight: FontWeight.w900,
                                                          color: KColors.navy)),
                                                ],
                                              ),
                                              const SizedBox(height: 10),
                                              Row(
                                                children: [
                                                  StatusChip(status: b.status),
                                                  const Spacer(),
                                                  const Text('View details',
                                                      style: TextStyle(
                                                          color: KColors.blue,
                                                          fontSize: 12,
                                                          fontWeight: FontWeight.w700)),
                                                  const Icon(Icons.chevron_right,
                                                      size: 16, color: KColors.blue),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ))
                                  .toList(),
                            ),
            ),
          ),
        ],
      ),
    );
  }
}
