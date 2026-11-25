import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../services/admin_api.dart';

class LiveTrackingScreen extends StatefulWidget {
  const LiveTrackingScreen({super.key});

  @override
  State<LiveTrackingScreen> createState() => _LiveTrackingScreenState();
}

class _LiveTrackingScreenState extends State<LiveTrackingScreen> {
  final mapController = MapController();
  List<dynamic> bookings = [];
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() { loading = true; error = ''; });
    try {
      final result = await AdminApi.liveLocations();
      if (!mounted) return;
      setState(() => bookings = (result['bookings'] as List<dynamic>?) ?? []);
    } catch (e) {
      if (!mounted) return;
      setState(() => error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  LatLng? point(dynamic value) {
    if (value is! Map) return null;
    final lat = value['lat'];
    final lng = value['lng'];
    if (lat is! num || lng is! num) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return LatLng(lat.toDouble(), lng.toDouble());
  }

  List<Marker> get markers {
    final result = <Marker>[];
    for (final item in bookings) {
      if (item is! Map) continue;
      final customer = point(item['customerLivePoint']);
      final provider = point(item['providerLivePoint']);
      if (customer != null) {
        result.add(Marker(
          point: customer, width: 42, height: 42,
          child: const Tooltip(message: 'Customer', child: Icon(Icons.person_pin_circle, color: Colors.blue, size: 38)),
        ));
      }
      if (provider != null) {
        result.add(Marker(
          point: provider, width: 42, height: 42,
          child: const Tooltip(message: 'Provider', child: Icon(Icons.delivery_dining, color: Colors.deepOrange, size: 38)),
        ));
      }
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final first = bookings.cast<dynamic>().firstWhere(
      (b) => point(b is Map ? b['providerLivePoint'] : null) != null ||
          point(b is Map ? b['customerLivePoint'] : null) != null,
      orElse: () => null,
    );
    final initial = first == null ? const LatLng(26.9124, 75.7873) :
      (point(first['providerLivePoint']) ?? point(first['customerLivePoint'])!);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Service Tracking'),
        actions: [IconButton(onPressed: load, icon: const Icon(Icons.refresh))],
      ),
      body: Column(children: [
        if (loading) const LinearProgressIndicator(),
        if (error.isNotEmpty) Padding(
          padding: const EdgeInsets.all(12),
          child: Text(error, style: const TextStyle(color: Colors.red)),
        ),
        Expanded(
          flex: 3,
          child: FlutterMap(
            mapController: mapController,
            options: MapOptions(initialCenter: initial, initialZoom: 11),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.kaamdaar.superadmin',
              ),
              MarkerLayer(markers: markers),
              const RichAttributionWidget(
                attributions: [TextSourceAttribution('© OpenStreetMap contributors')],
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(children: [
            const Icon(Icons.person_pin_circle, color: Colors.blue),
            const Text(' Customer'),
            const SizedBox(width: 16),
            const Icon(Icons.delivery_dining, color: Colors.deepOrange),
            const Text(' Provider'),
            const Spacer(),
            Text('${bookings.length} active jobs', style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
        ),
        Expanded(
          flex: 2,
          child: bookings.isEmpty && !loading
            ? const Center(child: Text('No active bookings with live data'))
            : ListView.separated(
                padding: const EdgeInsets.all(12),
                itemCount: bookings.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final row = Map<String, dynamic>.from(bookings[index] as Map);
                  final customer = point(row['customerLivePoint']);
                  final provider = point(row['providerLivePoint']);
                  return ListTile(
                    leading: const CircleAvatar(child: Icon(Icons.home_repair_service)),
                    title: Text('${row['serviceName'] ?? 'Service booking'}'),
                    subtitle: Text('${row['status'] ?? 'Unknown'} · ${row['providerName'] ?? 'Provider not assigned'}\nCustomer GPS: ${customer == null ? 'Unavailable' : '${customer.latitude.toStringAsFixed(5)}, ${customer.longitude.toStringAsFixed(5)}'}\nProvider GPS: ${provider == null ? 'Unavailable' : '${provider.latitude.toStringAsFixed(5)}, ${provider.longitude.toStringAsFixed(5)}'}'),
                    isThreeLine: true,
                    onTap: () {
                      final target = provider ?? customer;
                      if (target != null) mapController.move(target, 15);
                    },
                  );
                },
              ),
        ),
      ]),
    );
  }
}
