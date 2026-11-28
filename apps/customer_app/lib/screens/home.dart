/// Home shell: bottom nav (Home / Bookings / Profile) with the mockup's
library;
/// home screen — location header, search, banner, categories, recent bookings.
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:speech_to_text/speech_to_text.dart' as stt;
import 'dart:convert';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'bookings.dart';
import 'notifications.dart';
import 'profile.dart';
import 'service.dart';
import 'tracking.dart';
import '../widgets/kaamdaar_bot.dart';

ImageProvider? _homeProfileImage(String source) {
  if (source.isEmpty) return null;
  try {
    if (source.startsWith('data:image/')) {
      final comma = source.indexOf(',');
      if (comma < 0) return null;
      return MemoryImage(base64Decode(source.substring(comma + 1)));
    }
    final uri = Uri.tryParse(source);
    if (uri != null && (uri.scheme == 'https' || uri.scheme == 'http')) {
      return NetworkImage(source);
    }
  } catch (_) {
    return null;
  }
  return null;
}

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
    final active = _tab == index;
    return Expanded(child: InkWell(
      borderRadius: BorderRadius.circular(18),
      onTap: () => setState(() => _tab = index),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(vertical: 9),
        decoration: BoxDecoration(color: active ? KColors.navy : Colors.transparent, borderRadius: BorderRadius.circular(18)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: active ? Colors.white : Colors.black45, size: 21),
          const SizedBox(height: 3),
          Text(label, style: TextStyle(color: active ? Colors.white : Colors.black45, fontSize: 10.5, fontWeight: FontWeight.w800)),
        ]),
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final pages = [
      _HomeTab(onOpenProfile: () => setState(() => _tab = 2)),
      const BookingsScreen(),
      const ProfileScreen(),
    ];
    return Scaffold(
      body: Stack(children: [
        IndexedStack(index: _tab, children: pages),
        const KaamdaarBotLauncher(),
      ]),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 4, 18, 10),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFE8EDF4)),
              boxShadow: [BoxShadow(color: KColors.navy.withOpacity(.12), blurRadius: 22, offset: const Offset(0, 8))],
            ),
            child: Row(children: [
              _navItem(0, Icons.home_rounded, 'Home'),
              _navItem(1, Icons.receipt_long_rounded, 'Bookings'),
              _navItem(2, Icons.person_rounded, 'Profile'),
            ]),
          ),
        ),
      ),
    );
  }
}

class _HomeTab extends StatefulWidget {
  final VoidCallback onOpenProfile;
  const _HomeTab({required this.onOpenProfile});

  @override
  State<_HomeTab> createState() => _HomeTabState();
}

class _HomeTabState extends State<_HomeTab> {
  final _search = TextEditingController();
  final ScrollController _categoryScrollController = ScrollController();
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _listening = false;
  List<ServiceItem> _services = [];
  List<String> _categories = [];
  List<BookingItem> _recent = [];
  List<ServiceItem> _recommended = [];
  SessionUser? _user;
  bool _loading = true;
  String? _error;
  String? _selectedCategory;
  String _locationLabel = 'Detecting your location…';
  double? _latitude;
  double? _longitude;

  @override
  void initState() {
    super.initState();
    _detectLocation();
  }

  Future<void> _detectLocation() async {
    try {
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
        if (mounted) setState(() => _locationLabel = 'Enable location to find nearby services');
        await _load();
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
      await _load();
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      // Start independent network requests together so home-screen startup is
      // bounded by the slowest request rather than the sum of each request.
      final userFuture = Api.restoreSession();
      final servicesFuture = Api.catalog(lat: _latitude, lng: _longitude);
      final user = await userFuture;
      final services = await servicesFuture;
      List<BookingItem> recent = [];
      List<ServiceItem> recommended = [];
      if (user != null) {
        final bookingsFuture = Api.userBookings(user.id);
        final recommendationsFuture = Api.get('/api/recommendations');
        final all = await bookingsFuture;
        recent = all.where((b) => b.isLive).toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
        try {
          final data = await recommendationsFuture;
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
        // Root catalogue records define the main categories; keep the full catalogue
        // so selecting a main category shows every service beneath it.
        _services = services;
        _categories = services.where((s) => s.parent.isEmpty && s.category.trim().isNotEmpty)
            .map((s) => s.category.trim()).toSet().toList()..sort();
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
    final categoryIds = <String>{};
    if (_selectedCategory != null) {
      // A category may contain nested services/sub-services. Include every
      // descendant of its root service, not only records with the same label.
      final roots = _services.where((s) => s.parent.isEmpty && s.category.trim() == _selectedCategory);
      categoryIds.addAll(roots.map((s) => s.id));
      var changed = true;
      while (changed) {
        changed = false;
        for (final service in _services) {
          if (service.parent.isNotEmpty && categoryIds.contains(service.parent) && categoryIds.add(service.id)) {
            changed = true;
          }
        }
      }
    }
    return _services.where((s) {
      final matchesCategory = _selectedCategory == null ||
          s.category.trim() == _selectedCategory || categoryIds.contains(s.id);
      final matchesQuery = q.isEmpty || s.name.toLowerCase().contains(q) ||
          s.category.toLowerCase().contains(q) || s.tagline.toLowerCase().contains(q);
      return matchesCategory && matchesQuery;
    }).toList();
  }

  Future<void> _toggleVoiceSearch() async {
    if (_listening) {
      await _speech.stop();
      if (mounted) setState(() => _listening = false);
      return;
    }
    try {
      final available = await _speech.initialize(
        onStatus: (status) {
          if (mounted && (status == 'done' || status == 'notListening')) {
            setState(() => _listening = false);
          }
        },
        onError: (_) {
          if (mounted) setState(() => _listening = false);
        },
      );
      if (!available || !mounted) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Voice search is not available on this device')),
          );
        }
        return;
      }
      setState(() => _listening = true);
      await _speech.listen(
        localeId: 'hi_IN',
        listenFor: const Duration(seconds: 12),
        pauseFor: const Duration(seconds: 3),
        onResult: (result) {
          if (!mounted) return;
          setState(() {
            _search.text = result.recognizedWords;
            _search.selection = TextSelection.collapsed(offset: _search.text.length);
          });
        },
      );
    } catch (_) {
      if (mounted) setState(() => _listening = false);
    }
  }

  @override
  void dispose() {
    _search.dispose();
    _categoryScrollController.dispose();
    _speech.stop();
    super.dispose();
  }

  void _selectCategory(String? category, int index) {
    if (_selectedCategory == category) return;
    setState(() => _selectedCategory = category);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_categoryScrollController.hasClients) return;
      final position = _categoryScrollController.position;
      const itemExtent = 102.0;
      const itemWidth = 91.0;
      final target = (index * itemExtent -
              (position.viewportDimension - itemWidth) / 2)
          .clamp(0.0, position.maxScrollExtent)
          .toDouble();
      _categoryScrollController.animateTo(
        target,
        duration: const Duration(milliseconds: 480),
        curve: Curves.easeInOutCubicEmphasized,
      );
    });
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
            /* Kaamdaar brand + saved location + profile */
            Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
              Container(
                width: 43, height: 43, padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: KColors.navy, borderRadius: BorderRadius.circular(14)),
                child: Image.asset('assets/kaamdaar-logo-white.png', fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(Icons.home_repair_service, color: KColors.flame, size: 27)),
              ),
              const SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('KAAMDAAR', style: TextStyle(color: KColors.navy, fontSize: 15, fontWeight: FontWeight.w900, letterSpacing: 1.2)),
                const SizedBox(height: 3),
                InkWell(onTap: _detectLocation, child: Row(children: [
                  const Icon(Icons.location_on, color: KColors.flame, size: 14),
                  const SizedBox(width: 3),
                  Expanded(child: Text(_locationLabel, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w700, color: KColors.navy, fontSize: 10.5))),
                  const Icon(Icons.keyboard_arrow_down, color: KColors.navy, size: 15),
                ])),
              ])),
              const SizedBox(width: 6),
              IconButton(
                tooltip: 'Notifications',
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NotificationsScreen())),
                icon: const Icon(Icons.notifications_none_rounded, color: KColors.navy, size: 25),
              ),
              InkWell(
                customBorder: const CircleBorder(),
                onTap: widget.onOpenProfile,
                child: CircleAvatar(radius: 22, backgroundColor: const Color(0xFFEAF0F7),
                  backgroundImage: _homeProfileImage(_user?.photo ?? ''),
                  child: (_user?.photo.isNotEmpty ?? false) ? null : const Icon(Icons.person_rounded, color: KColors.navy, size: 25)),
              ),
            ]),
            const SizedBox(height: 16),
            Text('Hi ${_user?.name ?? 'there'} 👋', style: const TextStyle(color: Colors.black54, fontSize: 12.5)),
            const SizedBox(height: 8),

            /* search bar */
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      hintText: 'Search AC repair, plumbing, cleaning...',
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
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _toggleVoiceSearch,
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    height: 50,
                    width: 50,
                    decoration: BoxDecoration(
                      color: _listening ? KColors.navy : KColors.flame,
                      borderRadius: BorderRadius.circular(17),
                      boxShadow: [BoxShadow(color: (_listening ? KColors.navy : KColors.flame).withOpacity(.22), blurRadius: 13, offset: const Offset(0, 5))],
                    ),
                    child: AnimatedSwitcher(
                      duration: const Duration(milliseconds: 180),
                      child: Icon(_listening ? Icons.graphic_eq_rounded : Icons.mic_rounded,
                        key: ValueKey(_listening), color: Colors.white, size: 25),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (!filtering) ...[
              /* Service discovery starts immediately below search. */
              const SizedBox(height: 8),
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
                /* Main categories only */
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Categories', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: KColors.navy)),
                    Text('${_services.length} services', style: const TextStyle(color: Colors.black45, fontSize: 12)),
                  ],
                ),
                const SizedBox(height: 13),
                SizedBox(
                  height: 112,
                  child: ListView.separated(
                    controller: _categoryScrollController,
                    scrollDirection: Axis.horizontal,
                    itemCount: _categories.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(width: 11),
                    itemBuilder: (context, index) {
                      final all = index == 0;
                      final category = all ? null : _categories[index - 1];
                      final active = _selectedCategory == category;
                      final label = all ? 'All' : category!;
                      final count = all ? _services.length : _services.where((service) => service.category == category).length;
                      return InkWell(
                        onTap: () => _selectCategory(category, index),
                        borderRadius: BorderRadius.circular(20),
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 220),
                          width: 91,
                          padding: const EdgeInsets.fromLTRB(8, 9, 8, 8),
                          decoration: BoxDecoration(
                            gradient: active ? const LinearGradient(colors: [KColors.navy, Color(0xFF1B4778)]) : null,
                            color: active ? null : Colors.white,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: active ? KColors.navy : const Color(0xFFE4EAF1)),
                            boxShadow: [BoxShadow(color: KColors.navy.withOpacity(active ? .13 : .045), blurRadius: 12, offset: const Offset(0, 4))],
                          ),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                            Container(
                              width: 43, height: 43,
                              decoration: BoxDecoration(
                                color: active ? Colors.white.withOpacity(.13) : KColors.flame.withOpacity(.10),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              child: Icon(all ? Icons.grid_view_rounded : iconFor(category!), color: active ? Colors.white : KColors.flame, size: 23),
                            ),
                            const SizedBox(height: 6),
                            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: active ? Colors.white : KColors.navy)),
                            Text('$count', style: TextStyle(fontSize: 9.5, color: active ? Colors.white70 : Colors.black45)),
                          ]),
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 380),
                  reverseDuration: const Duration(milliseconds: 300),
                  switchInCurve: Curves.easeOutCubic,
                  switchOutCurve: Curves.easeInCubic,
                  transitionBuilder: (child, animation) {
                    final slide = Tween<Offset>(
                      begin: const Offset(.12, 0),
                      end: Offset.zero,
                    ).animate(animation);
                    return FadeTransition(
                      opacity: animation,
                      child: SlideTransition(position: slide, child: child),
                    );
                  },
                  child: KeyedSubtree(
                    key: ValueKey<String>(_selectedCategory ?? '__all_services__'),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                _selectedCategory == null
                                    ? 'Explore all services'
                                    : '$_selectedCategory services',
                                style: const TextStyle(
                                  fontSize: 16,
                                  color: KColors.navy,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                            if (_selectedCategory != null)
                              TextButton(
                                onPressed: () => _selectCategory(null, 0),
                                child: const Text('View all'),
                              )
                            else
                              Text(
                                '${_services.length} available',
                                style: const TextStyle(fontSize: 11, color: Colors.black45),
                              ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        if (_filtered.isEmpty)
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 22),
                            child: Text(
                              'No services available in this category yet.',
                              style: TextStyle(color: Colors.black54),
                            ),
                          )
                        else
                          LayoutBuilder(
                            builder: (context, constraints) {
                              final width = (constraints.maxWidth - 10) / 2;
                              return Wrap(
                                spacing: 10,
                                runSpacing: 10,
                                children: _filtered.map((service) => SizedBox(
                                  width: width,
                                  child: _ServiceMiniCard(
                                    service: service,
                                    onTap: () => _open(service),
                                  ),
                                )).toList(),
                              );
                            },
                          ),
                      ],
                    ),
                  ),
                ),

                  const SizedBox(height: 22),
                  if (_recommended.isNotEmpty) ...[
                    const Text('Recommended for You', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: KColors.navy)),
                    const SizedBox(height: 4),
                    const Text('Based on your service history', style: TextStyle(fontSize: 11.5, color: Colors.black54)),
                    const SizedBox(height: 10),
                    ..._recommended.map((service) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: CardBox(onTap: () => _open(service), child: Row(children: [
                        Icon(iconFor(service.icon.isEmpty ? service.category : service.icon), color: KColors.flame, size: 24),
                        const SizedBox(width: 10),
                        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(service.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13.5)),
                          Text(service.tagline.isEmpty ? service.category : service.tagline, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
                        ])),
                        Text(rupees(service.price), style: const TextStyle(fontWeight: FontWeight.w900, color: KColors.flame)),
                      ])),
                    )),
                  ],
                  const Text('Popular Services', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: KColors.navy)),
                  const SizedBox(height: 10),
                  ..._services.take(6).map((service) => Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: CardBox(onTap: () => _open(service), child: Row(children: [
                      Container(height: 44, width: 44, decoration: BoxDecoration(color: KColors.navy.withOpacity(.07), borderRadius: BorderRadius.circular(13)),
                        child: Icon(iconFor(service.icon.isEmpty ? service.category : service.icon), color: KColors.navy, size: 22)),
                      const SizedBox(width: 11),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(service.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                        Text(service.tagline.isEmpty ? service.category : service.tagline, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Colors.black54, fontSize: 11.5)),
                      ])),
                      Text(rupees(service.price), style: const TextStyle(fontWeight: FontWeight.w900, color: KColors.flame)),
                      const Icon(Icons.chevron_right, color: Colors.black38),
                    ])),
                  )),
                  ],
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

class _ServiceMiniCard extends StatelessWidget {
  final ServiceItem service;
  final VoidCallback onTap;
  const _ServiceMiniCard({required this.service, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(17),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(17),
        child: Container(
          constraints: const BoxConstraints(minHeight: 128),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(17),
            border: Border.all(color: const Color(0xFFE5EAF1)),
            boxShadow: [BoxShadow(color: KColors.navy.withOpacity(.045), blurRadius: 11, offset: const Offset(0, 4))],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(width: 37, height: 37, decoration: BoxDecoration(color: KColors.flame.withOpacity(.11), borderRadius: BorderRadius.circular(12)),
              child: Icon(iconFor(service.icon.isEmpty ? service.category : service.icon), color: KColors.flame, size: 20)),
            const SizedBox(height: 9),
            Text(service.name, maxLines: 2, overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: KColors.navy, height: 1.2)),
            const Spacer(),
            const SizedBox(height: 8),
            Row(children: [
              Expanded(child: Text(rupees(service.price), style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w900, color: KColors.flame))),
              const Icon(Icons.arrow_forward_rounded, size: 16, color: Colors.black38),
            ]),
          ]),
        ),
      ),
    );
  }
}
