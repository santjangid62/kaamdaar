import 'package:flutter/material.dart';
import '../services/admin_api.dart';

class CollectionScreen extends StatefulWidget {
  final String collection;
  final String title;
  const CollectionScreen({
    super.key,
    required this.collection,
    required this.title,
  });

  @override
  State<CollectionScreen> createState() => _CollectionScreenState();
}

class _CollectionScreenState extends State<CollectionScreen> {
  final search = TextEditingController();
  List<dynamic> rows = [];
  bool loading = true;
  String error = '';

  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = '';
    });
    try {
      final result = await AdminApi.collection(
        widget.collection,
        query: search.text,
      );
      if (!mounted) return;
      setState(() => rows = (result['rows'] as List<dynamic>?) ?? []);
    } catch (e) {
      if (!mounted) return;
      final message = e.toString().replaceFirst('Exception: ', '');
      setState(() => error = message);
      if (message.contains('Session expired')) {
        await AdminApi.logout();
        if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String displayValue(dynamic value) {
    if (value == null) return '—';
    if (value is Map || value is List) return value.toString();
    final text = value.toString();
    return text.length > 140 ? '${text.substring(0, 137)}...' : text;
  }

  String titleFor(Map<String, dynamic> row) {
    for (final key in [
      'name', 'title', 'serviceName', 'providerName', 'customer',
      'userName', 'phone', 'id'
    ]) {
      final value = row[key];
      if (value != null && value.toString().trim().isNotEmpty) {
        return value.toString();
      }
    }
    return 'Record';
  }

  String subtitleFor(Map<String, dynamic> row) {
    const ignored = {
      'id', 'name', 'title', 'serviceName', 'providerName', 'customer',
      'userName', 'createdAt', 'updatedAt', 'attachments', 'evidence',
    };
    final entries = row.entries
        .where((entry) => !ignored.contains(entry.key))
        .where((entry) => !RegExp(r'password|token|secret|otp|hash|data',
            caseSensitive: false).hasMatch(entry.key))
        .take(3)
        .map((entry) => '${entry.key}: ${displayValue(entry.value)}')
        .toList();
    return entries.join('  ·  ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          IconButton(onPressed: load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: TextField(
              controller: search,
              onSubmitted: (_) => load(),
              decoration: InputDecoration(
                hintText: 'Search ${widget.title.toLowerCase()}',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: IconButton(
                  onPressed: () {
                    search.clear();
                    load();
                  },
                  icon: const Icon(Icons.clear),
                ),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: load,
              child: loading
                  ? const Center(child: CircularProgressIndicator())
                  : error.isNotEmpty
                      ? ListView(
                          children: [
                            const SizedBox(height: 80),
                            Center(child: Text(error)),
                            TextButton(onPressed: load, child: const Text('Retry')),
                          ],
                        )
                      : rows.isEmpty
                          ? ListView(
                              children: [
                                const SizedBox(height: 90),
                                Icon(Icons.inbox_outlined,
                                    size: 52, color: Colors.blueGrey.shade300),
                                const SizedBox(height: 12),
                                const Center(child: Text('No records found')),
                              ],
                            )
                          : ListView.separated(
                              padding: const EdgeInsets.all(16),
                              itemCount: rows.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                final row = Map<String, dynamic>.from(
                                  rows[index] as Map,
                                );
                                final subtitle = subtitleFor(row);
                                return Card(
                                  child: ListTile(
                                    leading: CircleAvatar(
                                      backgroundColor: const Color(0xFFFFF0E0),
                                      child: Text(
                                        '${index + 1}',
                                        style: const TextStyle(
                                          color: Color(0xFF0B2240),
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    title: Text(
                                      titleFor(row),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                    subtitle: subtitle.isEmpty
                                        ? null
                                        : Text(
                                            subtitle,
                                            maxLines: 3,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                    trailing: const Icon(Icons.chevron_right),
                                    onTap: () => showModalBottomSheet<void>(
                                      context: context,
                                      isScrollControlled: true,
                                      builder: (_) => SafeArea(
                                        child: DraggableScrollableSheet(
                                          expand: false,
                                          initialChildSize: 0.65,
                                          builder: (context, controller) =>
                                              ListView(
                                            controller: controller,
                                            padding: const EdgeInsets.all(20),
                                            children: [
                                              Text(
                                                titleFor(row),
                                                style: Theme.of(context)
                                                    .textTheme
                                                    .titleLarge,
                                              ),
                                              const SizedBox(height: 12),
                                              ...row.entries
                                                  .where((entry) =>
                                                      !RegExp(
                                                        r'password|token|secret|otp|hash|attachments',
                                                        caseSensitive: false,
                                                      ).hasMatch(entry.key))
                                                  .map(
                                                    (entry) => ListTile(
                                                      dense: true,
                                                      title: Text(entry.key),
                                                      subtitle: Text(
                                                        displayValue(entry.value),
                                                      ),
                                                    ),
                                                  ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
            ),
          ),
        ],
      ),
    );
  }
}
