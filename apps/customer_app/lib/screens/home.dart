/// Home shell: bottom nav (Home / Bookings / Profile) with the mockup's
library;
/// home screen — location header, search, banner, categories, recent bookings.
import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'bookings.dart';
import 'profile.dart';
import 'service.dart';
import 'tracking.dart';

/// Category / service icon lookup (admin chooses lucide names on the web;
/// the app maps by keyword so any admin-added service still gets a glyph).
IconData iconFor(String key) {
  final k = key.toLowerCase();
  if (k.contains('ac') || k.contains('air')) return Icons.ac_unit;
  if (k.contains('plumb') || k.contains('pipe') || k.contains('tap')) {
    return Icons.plumbing;
  }
  if (k.contains('electric') || k.contains('wiring')) return Icons.bolt;
  if (k.contains('clean') || k.contains('sweep')) return Icons.cleaning_services;
  if (k.contains('paint')) return Icons.format_paint;
  if (k.contains('carp') || k.contains('wood')) return Icons.chair;
  if (k.contains('appliance') || k.contains('washer')) return Icons.local_laundry_service;
  if (k.contains('pest')) return Icons.bug_report;
  if (k.contains('beaut') || k.contains('salon')) return Icons.content_cut;
  if (k.contains('mason') || k.contains('wall')) return Icons.foundation;
  if (k.contains('garden') || k.contains('lawn')) return Icons.grass;
  if (k.contains('water') || k.contains('tank')) return Icons.water_drop;
  if (k.contains('install')) return Icons.build;
  return Icons.home_repair_service;
}

class HomeScreen extends StatefulWidget {
  final int homeTab;
  const HomeScreen({super.key, this.homeTab = 0});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _tab = widget.homeTab;
  }

  @override
  Widget build(BuildContext context) {
    final pages = [const _HomeTab(), const BookingsScreen(), const ProfileScreen()];
    return Scaffold(
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tab,
        onTap: (i) => setState(() => _tab = i),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: KColors.flame,
        unselectedItemColor: Colors.black45,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), activeIcon: Icon(Icons.receipt_long), label: 'Bookings'),
          BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

class _HomeTab extends StatefulWidget {
  const _HomeTab();

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> {
  final _search = TextEditingController();
  List<ServiceItem> _services = [];
  List<String> _categories = [];
  List<BookingItem> _recent = [];
  SessionUser? _user;
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
      // area-aware catalogue: services covered by a Pro near the customer are
      // listed first, every other service still follows in the same list
      final services = await Api.catalog(lat: 26.975, lng: 75.762);
      List<BookingItem> recent = [];
      if (user != null) {
        final all = await Api.userBookings(user.id);
        recent = all.where((b) => b.isLive).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
      }
      if (!mounted) return;
      setState(() {
        _user = user;
        _services = services;
        _categories = services.map((s) => s.category).toSet().toList();
        _recent = recent;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<ServiceItem> get _filtered {
    final q = _search.text.trim().toLowerCase();
    if (q.isEmpty) return _services;
    return _services
        .where((s) =>
            s.name.toLowerCase().contains(q) ||
            s.category.toLowerCase().contains(q) ||
            s.tagline.toLowerCase().contains(q))
        .toList();
  }

  void _open(ServiceItem s) {
    Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => ServiceDetailScreen(service: s)))
        .then((_) => _load());
  }

  @override
  Widget build(BuildContext context) {
    final filtering = _search.text.trim().isNotEmpty;
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            /* location header */
            Row(
              children: [
                const Icon(Icons.location_on, color: KColors.flame, size: 20),
                const SizedBox(width: 6),
                const Expanded(
                  child: Text('Jaipur, Rajasthan',
                      style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy, fontSize: 15)),
                ),
                IconButton(
                  onPressed: () {},
                  icon: const Icon(Icons.notifications_none, color: KColors.navy),
                ),
                IconButton(
                  onPressed: () => setState(() {}),
                  icon: const Icon(Icons.menu, color: KColors.navy),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text('Hi ${_user?.name ?? 'there'} 👋',
                style: const TextStyle(color: Colors.black54, fontSize: 13)),
            const SizedBox(height: 12),

            /* search bar */
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Search for a service...',
                      hintStyle: const TextStyle(color: Colors.black38, fontSize: 14),
                      prefixIcon: const Icon(Icons.search, color: Colors.black45),
                      suffixIcon: _search.text.isEmpty
                          ? const Icon(Icons.mic_none, color: KColors.flame)
                          : IconButton(
                              icon: const Icon(Icons.close, color: Colors.black45),
                              onPressed: () {
                                _search.clear();
                                setState(() {});
                              },
                            ),
                      isDense: true,
                      contentPadding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  height: 48,
                  width: 48,
                  decoration: BoxDecoration(
                    color: KColors.flame,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: const Icon(Icons.tune, color: Colors.white),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (!filtering) ...[
              /* banner */
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                      colors: [KColors.navy, Color(0xFF173A6B)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Har Kaam Turant',
                              style: TextStyle(
                                  color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900)),
                          const SizedBox(height: 4),
                          Text('Verified professionals at your doorstep',
                              style: TextStyle(color: Colors.white.withOpacity(.75), fontSize: 12.5)),
                          const SizedBox(height: 12),
                          FilledButton(
                            onPressed: () => _search.text = 'ac',
                            style: FilledButton.styleFrom(
                                backgroundColor: KColors.flame,
                                foregroundColor: KColors.navy,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8)),
                            child: const Text('Book Now →',
                                style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                          color: KColors.flame.withOpacity(.2), shape: BoxShape.circle),
                      child: const Icon(Icons.home_repair_service, color: KColors.flame, size: 40),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              if (_loading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(child: CircularProgressIndicator(color: KColors.flame)),
                )
              else if (_error != null) ...[
                CardBox(
                  child: Column(
                    children: [
                      Text('Could not load services: $_error',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: Colors.black54, fontSize: 13)),
                      const SizedBox(height: 10),
                      GhostBtn(label: 'Retry', onPressed: _load, color: KColors.flame),
                    ],
                  ),
                ),
              ] else ...[
                /* categories */
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Categories',
                        style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: KColors.navy)),
                    Text('${_services.length} services',
                        style: const TextStyle(color: Colors.black45, fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 12),
                GridView.count(
                  crossAxisCount: 4,
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  mainAxisSpacing: 14,
                  crossAxisSpacing: 8,
                  children: _categories.take(8).map((c) {
                    return InkWell(
                      onTap: () {
                        final first = _services.firstWhere((s) => s.category == c,
                            orElse: () => _services.first);
                        _open(first);
                      },
                      borderRadius: BorderRadius.circular(12),
                      child: Column(
                        children: [
                          Container(
                            height: 54,
                            width: 54,
                            decoration: BoxDecoration(
                              color: KColors.flame.withOpacity(.12),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(iconFor(c), color: KColors.flame, size: 26),
                          ),
                          const SizedBox(height: 6),
                          Text(c,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 20),

                /* popular services */
                const Text('Popular Services',
                    style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: KColors.navy)),
                const SizedBox(height: 10),
                ..._services.take(6).map((s) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: CardBox(
                        onTap: () => _open(s),
                        child: Row(
                          children: [
                            Container(
                              height: 46,
                              width: 46,
                              decoration: BoxDecoration(
                                color: KColors.navy.withOpacity(.08),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(iconFor(s.icon.isEmpty ? s.category : s.icon),
                                  color: KColors.navy, size: 22),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(s.name,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.w800, fontSize: 14.5)),
                                  Text(s.tagline.isEmpty ? s.category : s.tagline,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(color: Colors.black54, fontSize: 12.5)),
                                ],
                              ),
                            ),
                            Text(rupees(s.price),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w900, color: KColors.flame, fontSize: 15)),
                            const Icon(Icons.chevron_right, color: Colors.black38),
                          ],
                        ),
                      ),
                    )),
              ],
            ] else ...[
              /* search results */
              if (_filtered.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(
                      child: Text('No services match your search',
                          style: TextStyle(color: Colors.black45))),
                )
              else
                ..._filtered.map((s) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: CardBox(
                      onTap: () => _open(s),
                      child: Row(
                        children: [
                          Icon(iconFor(s.icon.isEmpty ? s.category : s.icon),
                              color: KColors.flame),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(s.name,
                                    style:
                                        const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5)),
                                Text(s.tagline.isEmpty ? s.category : s.tagline,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(color: Colors.black54, fontSize: 12.5)),
                              ],
                            ),
                          ),
                          Text(rupees(s.price),
                              style: const TextStyle(
                                  fontWeight: FontWeight.w900, color: KColors.flame)),
                          const Icon(Icons.chevron_right, color: Colors.black38),
                        ],
                      ),
                      ),
                    )),
            ],

            /* recent / live bookings */
            if (!filtering && _recent.isNotEmpty) ...[
              const SizedBox(height: 8),
              const Text('My Bookings',
                  style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: KColors.navy)),
              const SizedBox(height: 10),
              ..._recent.take(3).map((b) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: CardBox(
                      onTap: () async {
                        await Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => TrackScreen(bookingId: b.id)));
                        _load();
                      },
                      child: Row(
                        children: [
                          Container(
                            height: 46,
                            width: 46,
                            decoration: BoxDecoration(
                              color: KColors.blue.withOpacity(.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.receipt_long, color: KColors.blue),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(b.serviceName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800, fontSize: 14.5)),
                                Text(b.date.isEmpty ? 'Today' : b.date,
                                    style:
                                        const TextStyle(color: Colors.black54, fontSize: 12.5)),
                              ],
                            ),
                          ),
                          StatusChip(status: b.status),
                        ],
                      ),
                    ),
                  )),
            ],
          ],
        ),
      ),
    );
  }
}