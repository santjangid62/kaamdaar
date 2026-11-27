import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/theme.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  bool _loading = true;
  String? _error;
  List<Map<String, dynamic>> _rows = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() { _loading = true; _error = null; });
    try {
      final data = await Api.get('/api/notifications');
      if (!mounted) return;
      setState(() => _rows = (data['notifications'] as List? ?? [])
          .whereType<Map<String, dynamic>>().toList());
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications'), actions: [
        IconButton(onPressed: _load, icon: const Icon(Icons.refresh_rounded)),
      ]),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: KColors.flame))
          : _error != null
              ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
              : _rows.isEmpty
                  ? const Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
                      Icon(Icons.notifications_none_rounded, size: 48, color: Colors.black26),
                      SizedBox(height: 10),
                      Text('You are all caught up', style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
                      SizedBox(height: 4),
                      Text('Booking and support updates will appear here.', style: TextStyle(color: Colors.black54, fontSize: 12)),
                    ]))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _rows.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 9),
                        itemBuilder: (context, index) {
                          final row = _rows[index];
                          final title = (row['title'] ?? 'Kaamdaar update').toString();
                          final message = (row['message'] ?? '').toString();
                          final complaintId = (row['complaintId'] ?? '').toString();
                          final unread = row['readAt'] == null;
                          final created = DateTime.fromMillisecondsSinceEpoch(
                              (row['createdAt'] as num?)?.toInt() ?? 0);
                          return Container(
                            padding: const EdgeInsets.all(15),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(17),
                              border: Border.all(color: unread ? KColors.flame.withOpacity(.28) : const Color(0xFFE6EBF2)),
                              boxShadow: [BoxShadow(color: KColors.navy.withOpacity(.04), blurRadius: 12, offset: const Offset(0, 4))],
                            ),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Row(children: [
                                Icon(complaintId.isNotEmpty ? Icons.support_agent_rounded : Icons.notifications_active_rounded,
                                    color: KColors.flame, size: 19),
                                const SizedBox(width: 8),
                                Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, color: KColors.navy))),
                                if (unread) Container(width: 8, height: 8, decoration: const BoxDecoration(color: KColors.flame, shape: BoxShape.circle)),
                              ]),
                              const SizedBox(height: 8),
                              Text(message, style: const TextStyle(fontSize: 12.5, height: 1.4, color: Colors.black87)),
                              if (complaintId.isNotEmpty) ...[
                                const SizedBox(height: 7),
                                Text('Complaint ID: $complaintId', style: const TextStyle(fontSize: 11, color: KColors.green, fontWeight: FontWeight.w800)),
                              ],
                              const SizedBox(height: 7),
                              Text('${created.day.toString().padLeft(2, '0')}/${created.month.toString().padLeft(2, '0')}/${created.year}  •  ${TimeOfDay.fromDateTime(created).format(context)}',
                                  style: const TextStyle(fontSize: 10.5, color: Colors.black45)),
                            ]),
                          );
                        },
                      ),
                    ),
    );
  }
}
