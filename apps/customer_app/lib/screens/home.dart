/// Home shell: bottom nav (Home / Bookings / Profile) with the mockup's
library;
/// home screen — location header, search, banner, categories, recent bookings.
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

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

  Widget _navItem(int index, IconData icon, String label) {
    final selected = _tab == index;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _tab = index),
        borderRadius: BorderRadius.circular(18),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          decoration: BoxDecoration(
            color: selected ? const Color(0xFFFFC857) : Colors.transparent,
            borderRadius: BorderRadius.circular(17),
          ),
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            Icon(icon, color: selected ? KColors.navy : Colors.white.withOpacity(.78), size: 22),
            const SizedBox(height: 2),
            Text(label, style: TextStyle(color: selected ? KColors.navy : Colors.white.withOpacity(.82), fontSize: 10.5, fontWeight: FontWeight.w800)),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final pages = [const _HomeTab(), const BookingsScreen(), const ProfileScreen()];
    return Scaffold(
      backgroundColor: const Color(0xFFF7F9FC),
      body: IndexedStack(index: _tab, children: pages),
      extendBody: true,
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        child: Container(
          height: 68,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
          decoration: BoxDecoration(
            color: const Color(0xFF102F50),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [BoxShadow(color: KColors.navy.withOpacity(.22), blurRadius: 22, offset: const Offset(0, 9))],
          ),
          child: Row(children: [
            _navItem(0, Icons.home_rounded, 'Home'),
            _navItem(1, Icons.calendar_month_rounded, 'Bookings'),
            _navItem(2, Icons.person_rounded, 'Profile'),
          ]),
        ),
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
  List<ServiceItem> _recommended = [];
  SessionUser? _user;
  bool _loading = true;
  String? _error;
  String _locationLabel = 'Detecting your location…';
  double? _latitude;
  double? _longitude;
  String _selectedCategory = 'All';
  int _hintIndex = 0;
  Timer? _hintTimer;
  final List<String> _searchHints = const [
    'Search “AC repair”',
    'Search “Plumber”',
    'Search “Electrician”',
    'Search “Home cleaning”',
    'Search “Beauty services”',
  ];

  @override
  void initState() {
    super.initState();
    _detectLocation();
    _load();
    _hintTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted && _search.text.isEmpty) {
        setState(() => _hintIndex = (_hintIndex + 1) % _searchHints.length);
      }
    });
  }

  @override
  void dispose() {
    _hintTimer?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _detectLocation() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        if (mounted) setState(() => _locationLabel = 'Enable location to find nearby services');
        return;
      }
      var position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.bestForNavigation, timeLimit: Duration(seconds: 15)),
      );
      // A second GPS sample often improves the first fix on phones that have
      // just enabled location or are moving from indoors to open sky.
      if (position.accuracy > 60) {
        try {
          final retry = await Geolocator.getCurrentPosition(
            locationSettings: const LocationSettings(accuracy: LocationAccuracy.bestForNavigation, timeLimit: Duration(seconds: 12)),
          );
          if (retry.accuracy < position.accuracy) position = retry;
        } catch (_) {}
      }
      final locationIsPrecise = position.accuracy <= 100;
      var label = locationIsPrecise
          ? 'Current location'
          : 'GPS accuracy low (±${position.accuracy.round()} m) — tap to retry';
      if (locationIsPrecise) try {
        final uri = Uri.https('nominatim.openstreetmap.org', '/reverse', {
          'format': 'jsonv2', 'lat': '${position.latitude}', 'lon': '${position.longitude}',
          'zoom': '18', 'addressdetails': '1', 'accept-language': 'en',
        });
        final response = await http.get(uri, headers: {'User-Agent': 'Kaamdaar/1.0 (location lookup)'});
        if (response.statusCode == 200) {
          final data = jsonDecode(response.body) as Map<String, dynamic>;
          final a = (data['address'] as Map?)?.cast<String, dynamic>() ?? {};
          final street = [a['house_number'], a['road']].where((v) => v != null && '$v'.isNotEmpty).join(' ');
          final locality = a['suburb'] ?? a['neighbourhood'] ?? a['quarter'] ?? a['village'] ?? a['town'] ?? a['city_district'] ?? a['city'] ?? '';
          final city = a['city'] ?? a['town'] ?? a['village'] ?? a['state_district'] ?? '';
          final pin = a['postcode'] ?? '';
          label = [street, locality, city, pin].where((v) => '$v'.isNotEmpty).toSet().join(', ');
          if (label.isEmpty) label = (data['display_name'] ?? 'Current location').toString();
        }
      } catch (_) {}
      if (mounted) setState(() {
        _latitude = locationIsPrecise ? position.latitude : null;
        _longitude = locationIsPrecise ? position.longitude : null;
        _locationLabel = label;
      });
      if (locationIsPrecise) {
        try {
          await Api.post('/api/location', {
            'latitude': position.latitude,
            'longitude': position.longitude,
            'accuracy': position.accuracy,
            'address': label,
          });
        } catch (_) {
          // Location remains available locally; server sync retries on next detection.
        }
      }
      await _load();
    } catch (_) {
      if (mounted) setState(() => _locationLabel = 'Could not detect location — tap to retry');
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = await Api.restoreSession();
      // area-aware catalogue: services covered by a Pro near the customer are
      // listed first, every other service still follows in the same list
      final services = await Api.catalog(lat: _latitude, lng: _longitude);
      List<BookingItem> recent = [];
      List<ServiceItem> recommended = [];
      if (user != null) {
        final all = await Api.userBookings(user.id);
        recent = all.where((b) => b.isLive).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        try {
          final data = await Api.get('/api/recommendations');
          recommended = (data['recommendations'] as List? ?? [])
              .whereType<Map<String, dynamic>>()
              .map(ServiceItem.fromJson)
              .toList();
        } catch (_) {
          // Recommendations are optional; catalogue browsing remains available.
        }
      }
      if (!mounted) return;
      setState(() {
        _user = user;
        _services = services.where((s) => s.parent.isEmpty).toList();
        _categories = services.where((s) => s.parent.isEmpty).map((s) => s.category).toSet().toList();
        _recent = recent;
        _recommended = recommended;
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
    final categoryServices = _selectedCategory == 'All'
        ? _services
        : _services.where((s) => s.category == _selectedCategory).toList();
    final visibleServices = filtering ? _filtered : categoryServices;

    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        color: KColors.flame,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 116),
          children: [
            // Kaamdaar brand header and saved/current service address.
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Container(
                  height: 42,
                  width: 42,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFC857), Color(0xFFFF8A35)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: [BoxShadow(color: KColors.flame.withOpacity(.2), blurRadius: 12, offset: const Offset(0, 5))],
                  ),
                  child: const Icon(Icons.home_repair_service_rounded, color: KColors.navy, size: 25),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Kaamdaar', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: KColors.navy, letterSpacing: -.6)),
                      const Text('HAR KAAM TURANT', style: TextStyle(fontSize: 8.5, fontWeight: FontWeight.w800, letterSpacing: 1.7, color: KColors.flame)),
                    ],
                  ),
                ),
                Material(
                  color: Colors.white,
                  shape: const CircleBorder(),
                  child: InkWell(
                    customBorder: const CircleBorder(),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ProfileScreen())),
                    child: Container(
                      height: 44,
                      width: 44,
                      decoration: BoxDecoration(shape: BoxShape.circle, border: Border.all(color: const Color(0xFFE7ECF2))),
                      child: const Icon(Icons.person_rounded, color: KColors.navy, size: 25),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            InkWell(
              onTap: _detectLocation,
              borderRadius: BorderRadius.circular(12),
              child: Row(
                children: [
                  const Icon(Icons.location_on_rounded, color: KColors.flame, size: 19),
                  const SizedBox(width: 5),
                  const Text('Delivering services at', style: TextStyle(color: Colors.black54, fontSize: 11.5, fontWeight: FontWeight.w600)),
                  const SizedBox(width: 5),
                  Expanded(
                    child: Text(_locationLabel, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: const TextStyle(color: KColors.navy, fontSize: 12.5, fontWeight: FontWeight.w800)),
                  ),
                  const Icon(Icons.keyboard_arrow_down_rounded, color: KColors.navy, size: 19),
                ],
              ),
            ),
            const SizedBox(height: 15),

            // Large rounded search field with rotating service suggestions.
            Row(
              children: [
                Expanded(
                  child: Container(
                    height: 54,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE8EDF4)),
                      boxShadow: [BoxShadow(color: KColors.navy.withOpacity(.045), blurRadius: 16, offset: const Offset(0, 6))],
                    ),
                    child: TextField(
                      controller: _search,
                      onChanged: (_) => setState(() {}),
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        hintText: _searchHints[_hintIndex],
                        hintStyle: const TextStyle(color: Color(0xFF8B96A6), fontSize: 14, fontWeight: FontWeight.w500),
                        prefixIcon: const Icon(Icons.search_rounded, color: KColors.navy, size: 25),
                        suffixIcon: _search.text.isEmpty ? null : IconButton(
                          icon: const Icon(Icons.close_rounded, color: Colors.black45),
                          onPressed: () { _search.clear(); setState(() {}); },
                        ),
                        contentPadding: const EdgeInsets.symmetric(vertical: 17),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Container(
                  height: 54,
                  width: 54,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [Color(0xFF173A6B), Color(0xFF285B91)]),
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: [BoxShadow(color: KColors.navy.withOpacity(.16), blurRadius: 12, offset: const Offset(0, 5))],
                  ),
                  child: const Icon(Icons.graphic_eq_rounded, color: Colors.white, size: 27),
                ),
              ],
            ),
            const SizedBox(height: 18),

            if (!filtering) ...[
              // Compact brand promise banner; no booking logic is changed.
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF12365D), Color(0xFF245B8C), Color(0xFF347AA0)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Har Kaam Turant!', style: TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 5),
                        Text('Trusted professionals. Right at your doorstep.', style: TextStyle(color: Colors.white.withOpacity(.82), fontSize: 11.5, height: 1.35)),
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
                          decoration: BoxDecoration(color: const Color(0xFFFFC857), borderRadius: BorderRadius.circular(20)),
                          child: const Text('Explore services  →', style: TextStyle(color: KColors.navy, fontSize: 11.5, fontWeight: FontWeight.w900)),
                        ),
                      ]),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      height: 78, width: 78,
                      decoration: BoxDecoration(color: Colors.white.withOpacity(.12), shape: BoxShape.circle),
                      child: const Icon(Icons.home_work_rounded, color: Color(0xFFFFC857), size: 43),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 22),
            ],

            if (_loading)
              const Padding(padding: EdgeInsets.symmetric(vertical: 42), child: Center(child: CircularProgressIndicator(color: KColors.flame)))
            else if (_error != null) ...[
              CardBox(
                child: Column(children: [
                  Text('Could not load services: $_error', textAlign: TextAlign.center, style: const TextStyle(color: Colors.black54, fontSize: 13)),
                  const SizedBox(height: 10),
                  GhostBtn(label: 'Retry', onPressed: _load, color: KColors.flame),
                ]),
              ),
            ] else ...[
              if (!filtering) ...[
                Row(
                  children: [
                    const Expanded(child: Text('Explore Categories', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: KColors.navy))),
                    Text('${_services.length} services', style: const TextStyle(color: Colors.black45, fontSize: 11.5)),
                  ],
                ),
                const SizedBox(height: 12),
                SizedBox(
                  height: 86,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _categories.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(width: 9),
                    itemBuilder: (context, index) {
                      final category = index == 0 ? 'All' : _categories[index - 1];
                      final selected = _selectedCategory == category;
                      return InkWell(
                        onTap: () => setState(() => _selectedCategory = category),
                        borderRadius: BorderRadius.circular(17),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          width: 76,
                          padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 5),
                          decoration: BoxDecoration(
                            color: selected ? KColors.navy : Colors.white,
                            borderRadius: BorderRadius.circular(17),
                            border: Border.all(color: selected ? KColors.navy : const Color(0xFFE9EDF3)),
                            boxShadow: selected ? [BoxShadow(color: KColors.navy.withOpacity(.16), blurRadius: 12, offset: const Offset(0, 5))] : [],
                          ),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Icon(category == 'All' ? Icons.apps_rounded : iconFor(category), color: selected ? const Color(0xFFFFC857) : KColors.navy, size: 25),
                            const SizedBox(height: 5),
                            Text(category, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: selected ? Colors.white : KColors.navy, fontSize: 10.5, fontWeight: FontWeight.w800)),
                          ]),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 20),
              ],

              if (_recommended.isNotEmpty && !filtering && _selectedCategory == 'All') ...[
                const Text('Recommended for You', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: KColors.navy)),
                const SizedBox(height: 4),
                const Text('Picked from your service history', style: TextStyle(fontSize: 11.5, color: Colors.black54)),
                const SizedBox(height: 10),
                ..._recommended.take(3).map((s) => _serviceCard(s)),
                const SizedBox(height: 10),
              ],

              Row(
                children: [
                  Expanded(child: Text(filtering ? 'Search Results' : (_selectedCategory == 'All' ? 'Popular Services' : _selectedCategory),
                    style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: KColors.navy))),
                  Text('${visibleServices.length} found', style: const TextStyle(color: Colors.black45, fontSize: 11.5)),
                ],
              ),
              const SizedBox(height: 10),
              if (visibleServices.isEmpty)
                const Padding(padding: EdgeInsets.symmetric(vertical: 36), child: Center(child: Text('No services in this category yet', style: TextStyle(color: Colors.black45))))
              else
                ...visibleServices.map(_serviceCard),
            ],

            if (!filtering && _recent.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('Your Active Bookings', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: KColors.navy)),
              const SizedBox(height: 10),
              ..._recent.take(3).map((b) => Padding(
                padding: const EdgeInsets.only(bottom: 9),
                child: CardBox(
                  onTap: () async {
                    await Navigator.of(context).push(MaterialPageRoute(builder: (_) => TrackScreen(bookingId: b.id)));
                    _load();
                  },
                  child: Row(children: [
                    Container(height: 44, width: 44, decoration: BoxDecoration(color: KColors.blue.withOpacity(.1), borderRadius: BorderRadius.circular(13)), child: const Icon(Icons.receipt_long_rounded, color: KColors.blue)),
                    const SizedBox(width: 11),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(b.serviceName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                      Text(b.date.isEmpty ? 'Today' : b.date, style: const TextStyle(color: Colors.black54, fontSize: 11.5)),
                    ])),
                    StatusChip(status: b.status),
                  ]),
                ),
              )),
            ],
          ],
        ),
      ),
    );
  }

  Widget _serviceCard(ServiceItem s) => Padding(
    padding: const EdgeInsets.only(bottom: 9),
    child: CardBox(
      onTap: () => _open(s),
      child: Row(children: [
        Container(
          height: 48, width: 48,
          decoration: BoxDecoration(color: KColors.navy.withOpacity(.07), borderRadius: BorderRadius.circular(14)),
          child: Icon(iconFor(s.icon.isEmpty ? s.category : s.icon), color: KColors.navy, size: 23),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(s.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5, color: KColors.navy)),
          const SizedBox(height: 3),
          Text(s.tagline.isEmpty ? s.category : s.tagline, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.black54, fontSize: 11.5)),
        ])),
        Text(rupees(s.price), style: const TextStyle(fontWeight: FontWeight.w900, color: KColors.flame, fontSize: 14)),
        const SizedBox(width: 3),
        const Icon(Icons.chevron_right_rounded, color: Colors.black38),
      ]),
    ),
  );
}
}