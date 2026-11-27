import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../core/models.dart';

class ProviderFeedbackScreen extends StatefulWidget {
  const ProviderFeedbackScreen({super.key});
  @override
  State<ProviderFeedbackScreen> createState() => _ProviderFeedbackScreenState();
}

class _ProviderFeedbackScreenState extends State<ProviderFeedbackScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 2, vsync: this);
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _complaints = [];
  List<Map<String, dynamic>> _reviews = [];

  @override
  void initState() { super.initState(); _load(); }
  @override
  void dispose() { _tabs.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final results = await Future.wait([
        Api.get('/api/complaints'),
        Api.get('/api/reviews'),
      ]);
      if (!mounted) return;
      setState(() {
        _complaints = (results[0]['complaints'] as List? ?? []).whereType<Map<String, dynamic>>().toList();
        _reviews = (results[1]['reviews'] as List? ?? []).whereType<Map<String, dynamic>>().toList();
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _date(dynamic raw) {
    final ms = (raw as num?)?.toInt() ?? 0;
    if (ms <= 0) return 'Date unavailable';
    final d = DateTime.fromMillisecondsSinceEpoch(ms);
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Complaints & Reviews'), actions: [
        IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
      ], bottom: TabBar(controller: _tabs, tabs: const [
        Tab(text: 'Complaints'), Tab(text: 'Reviews'),
      ])),
      body: _loading ? const Center(child: CircularProgressIndicator(color: PColors.green))
          : _error != null ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
          : TabBarView(controller: _tabs, children: [
              _complaintList(),
              _reviewList(),
            ]),
    );
  }

  Widget _complaintList() {
    if (_complaints.isEmpty) return const Center(child: Text('No complaints linked to your bookings.', style: TextStyle(color: Colors.black54)));
    return RefreshIndicator(onRefresh: _load, child: ListView.separated(
      padding: const EdgeInsets.all(14), itemCount: _complaints.length,
      separatorBuilder: (_, __) => const SizedBox(height: 9),
      itemBuilder: (context, i) {
        final c = _complaints[i];
        final status = (c['status'] ?? 'Open').toString();
        final closed = status.toLowerCase() == 'resolved' || status.toLowerCase() == 'closed';
        return CardBox(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text((c['issue'] ?? 'Customer complaint').toString(), maxLines: 2, overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w900, color: PColors.ink))),
            Container(padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              decoration: BoxDecoration(color: (closed ? PColors.green : PColors.amber).withValues(alpha: .12), borderRadius: BorderRadius.circular(30)),
              child: Text(status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: closed ? PColors.green : PColors.amber))),
          ]),
          const SizedBox(height: 7),
          Text('Customer: ${c['customer'] ?? 'Customer'}', style: const TextStyle(fontSize: 12, color: Colors.black54)),
          Text('Booking: ${c['bookingId'] ?? c['booking'] ?? '—'}  •  ${_date(c['createdAt'])}', style: const TextStyle(fontSize: 11, color: Colors.black45)),
          if ((c['adminResponse'] ?? '').toString().trim().isNotEmpty) ...[
            const Divider(height: 20),
            const Text('Admin response', style: TextStyle(fontWeight: FontWeight.w800, color: PColors.green)),
            Text(c['adminResponse'].toString(), style: const TextStyle(fontSize: 12.5, height: 1.4)),
          ],
        ]));
      },
    ));
  }

  Widget _reviewList() {
    if (_reviews.isEmpty) return const Center(child: Text('No customer reviews yet.', style: TextStyle(color: Colors.black54)));
    return RefreshIndicator(onRefresh: _load, child: ListView.separated(
      padding: const EdgeInsets.all(14), itemCount: _reviews.length,
      separatorBuilder: (_, __) => const SizedBox(height: 9),
      itemBuilder: (context, i) {
        final r = _reviews[i];
        final rating = ((r['providerRating'] ?? r['rating'] ?? 0) as num).toDouble();
        return CardBox(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(child: Text((r['author'] ?? r['name'] ?? 'Customer').toString(), style: const TextStyle(fontWeight: FontWeight.w900))),
            Row(children: List.generate(5, (n) => Icon(n < rating ? Icons.star_rounded : Icons.star_border_rounded, size: 16, color: PColors.amber))),
          ]),
          if ((r['service'] ?? '').toString().isNotEmpty) Text(r['service'].toString(), style: const TextStyle(fontSize: 11, color: Colors.black45)),
          const SizedBox(height: 6),
          Text((r['text'] ?? 'No written feedback').toString(), style: const TextStyle(fontSize: 12.5)),
          const SizedBox(height: 5),
          Text(_date(r['createdAt']), style: const TextStyle(fontSize: 10.5, color: Colors.black45)),
        ]));
      },
    ));
  }
}
