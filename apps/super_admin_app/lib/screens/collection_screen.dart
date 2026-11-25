import 'package:flutter/material.dart';\nimport 'package:share_plus/share_plus.dart';\nimport 'package:printing/printing.dart';\nimport 'package:pdf/widgets.dart' as pw;
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


  Future<void> exportReport({required bool print}) async {
    try {
      final csv = await AdminApi.csvReport(widget.collection);
      if (print) {
        final doc = pw.Document();
        doc.addPage(pw.MultiPage(build: (_) => [
          pw.Text('Kaamdaar - ${widget.title} Report', style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 12),
          pw.Text(csv, style: const pw.TextStyle(fontSize: 6)),
        ]));
        await Printing.layoutPdf(onLayout: (_) => doc.save());
      } else {
        await Share.share(csv, subject: 'Kaamdaar ${widget.title} CSV report');
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))));
    }
  }

  Future<void> runOwnerAction(Map<String, dynamic> row) async {
    final id = (row['id'] ?? '').toString();
    if (id.isEmpty) return;
    String? action;
    Map<String, dynamic> payload = {'id': id};
    if (widget.collection == 'users' || widget.collection == 'providers' || widget.collection == 'adminUsers') {
      final kind = widget.collection == 'users' ? 'customer' : widget.collection == 'providers' ? 'provider' : 'admin';
      final current = (row['status'] ?? 'active').toString();
      final next = current == 'blocked' ? 'active' : 'blocked';
      action = 'account_status';
      payload.addAll({'action': action, 'kind': kind, 'status': next});
    } else if (widget.collection == 'complaints') {
      final responseController = TextEditingController();
      String status = (row['status'] ?? 'In Review').toString();
      final accepted = await showDialog<bool>(context: context, builder: (dialogContext) => AlertDialog(
        title: const Text('Reply to complaint'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          DropdownButtonFormField<String>(value: ['Open','In Review','Escalated','Resolved'].contains(status) ? status : 'In Review', items: ['Open','In Review','Escalated','Resolved'].map((s) => DropdownMenuItem(value:s,child:Text(s))).toList(), onChanged:(v){ if(v!=null) status=v; }),
          TextField(controller: responseController, maxLines: 4, decoration: const InputDecoration(labelText: 'Customer-facing response')),
        ]),
        actions: [TextButton(onPressed:()=>Navigator.pop(dialogContext,false),child:const Text('Cancel')), ElevatedButton(onPressed:()=>Navigator.pop(dialogContext,true),child:const Text('Send reply'))],
      ));
      if (accepted != true) { responseController.dispose(); return; }
      action = 'complaint_reply';
      payload.addAll({'action':action,'status':status,'response':responseController.text});
      responseController.dispose();
    } else if (widget.collection == 'bookings' && ['reported','disputed'].contains(row['paymentStatus'])) {
      final decision = await showDialog<String>(context: context, builder: (ctx) => AlertDialog(
        title: const Text('Review reported payment'),
        content: const Text('Verify the payment (commission validation will run) or dispute this report?'),
        actions: [TextButton(onPressed:()=>Navigator.pop(ctx,'dispute'),child:const Text('Dispute')), ElevatedButton(onPressed:()=>Navigator.pop(ctx,'verify'),child:const Text('Verify'))],
      ));
      if (decision == null) return;
      action = 'booking_payment';
      payload.addAll({'action':action,'decision':decision});
    } else if (widget.collection == 'payouts' && row['status'] == 'Processing') {
      final referenceController = TextEditingController();
      final accepted = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
        title: const Text('Confirm payout completed'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Amount: ₹${row['amount'] ?? 0} · Provider: ${row['provider'] ?? row['providerId'] ?? '—'}'),
          const SizedBox(height: 12),
          const Text('Only confirm after the bank / UPI transfer has actually succeeded.'),
          TextField(controller: referenceController, decoration: const InputDecoration(labelText: 'Bank / UPI transaction reference')),
        ]),
        actions: [TextButton(onPressed:()=>Navigator.pop(ctx,false),child:const Text('Cancel')), ElevatedButton(onPressed:()=>Navigator.pop(ctx,true),child:const Text('Mark Paid'))],
      ));
      if (accepted != true) { referenceController.dispose(); return; }
      action = 'payout_mark_paid';
      payload.addAll({'action':action,'reference':referenceController.text});
      referenceController.dispose();
    } else if (widget.collection == 'providerPayments' && row['status'] == 'pending') {
      final otpController = TextEditingController();
      final decision = await showDialog<String>(context: context, builder: (ctx) => AlertDialog(
        title: const Text('Verify provider payment'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text('Demo verification OTP: ${row['verificationOtp'] ?? 'Not available'}'),
          TextField(controller: otpController, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Enter OTP')),
        ]),
        actions: [TextButton(onPressed:()=>Navigator.pop(ctx,'reject'),child:const Text('Reject')), ElevatedButton(onPressed:()=>Navigator.pop(ctx,'verify'),child:const Text('Verify'))],
      ));
      if (decision == null) { otpController.dispose(); return; }
      action = 'provider_payment';
      payload.addAll({'action':action,'decision':decision,'otp':otpController.text});
      otpController.dispose();
    }
    if (action == null) return;
    try {
      await AdminApi.action(payload);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Action completed successfully')));
      await load();
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))));
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
