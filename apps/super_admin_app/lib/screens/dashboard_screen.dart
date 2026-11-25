import 'package:flutter/material.dart';\nimport 'package:share_plus/share_plus.dart';\nimport 'package:printing/printing.dart';\nimport 'package:pdf/widgets.dart' as pw;
import '../services/admin_api.dart';
import 'collection_screen.dart';
import 'live_tracking_screen.dart';

class DashboardScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const DashboardScreen({super.key, required this.onLogout});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? data;
  String error = '';
  bool loading = true;

  static const modules = [
    _Module('Admins', 'adminUsers', Icons.admin_panel_settings),
    _Module('Customers', 'users', Icons.people),
    _Module('Providers', 'providers', Icons.engineering),
    _Module('Bookings', 'bookings', Icons.book_online),
    _Module('Services', 'services', Icons.home_repair_service),
    _Module('Categories', 'categories', Icons.category),
    _Module('Complaints', 'complaints', Icons.support_agent),
    _Module('Provider Payments', 'providerPayments', Icons.payments),
    _Module('Wallets', 'wallets', Icons.account_balance_wallet),
    _Module('Payouts', 'payouts', Icons.account_balance),
    _Module('Notifications', 'notifications', Icons.notifications),
    _Module('Activity Logs', 'auditLogs', Icons.receipt_long),
    _Module('Reviews', 'reviews', Icons.star),
    _Module('Campaigns', 'campaigns', Icons.campaign),
  ];

  @override
  void initState() {
    super.initState();
    load();
  }


  Future<void> exportDashboard({required bool print}) async {
    try {
      final csv = await AdminApi.csvReport('dashboard');
      if (print) {
        final doc = pw.Document();
        doc.addPage(pw.Page(build: (_) => pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text('Kaamdaar Dashboard Report', style: pw.TextStyle(fontSize: 20, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 16),
          pw.Text(csv, style: const pw.TextStyle(fontSize: 10)),
        ])));
        await Printing.layoutPdf(onLayout: (_) => doc.save());
      } else {
        await Share.share(csv, subject: 'Kaamdaar Dashboard CSV report');
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))));
    }
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = '';
    });
    try {
      final result = await AdminApi.overview();
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (!mounted) return;
      final message = e.toString().replaceFirst('Exception: ', '');
      setState(() => error = message);
      if (message.contains('Session expired')) widget.onLogout();
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String money(dynamic value) =>
      '₹${(value is num ? value : 0).round()}';

  Widget metric(String label, dynamic value, IconData icon) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: const Color(0xFFFFF0E0),
                child: Icon(icon, color: const Color(0xFFB45309)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: const TextStyle(
                            color: Colors.black54, fontSize: 12)),
                    const SizedBox(height: 4),
                    Text('$value',
                        style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: Color(0xFF0B2240))),
                  ],
                ),
              ),
            ],
          ),
        ),
      );

  void openModule(_Module module) {
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => CollectionScreen(
        collection: module.collection,
        title: module.title,
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final metrics = (data?['metrics'] as Map<String, dynamic>?) ?? {};
    final queues = (data?['queues'] as Map<String, dynamic>?) ?? {};
    return Scaffold(
      appBar: AppBar(
        title: const Text('Owner Control Centre'),
        actions: [
          IconButton(onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const LiveTrackingScreen())), icon: const Icon(Icons.map_outlined), tooltip: 'Live tracking'),
          IconButton(onPressed: load, icon: const Icon(Icons.refresh)),
          IconButton(
              onPressed: widget.onLogout,
              icon: const Icon(Icons.logout)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: load,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('KAAMDAAR OVERVIEW',
                style: TextStyle(
                    fontWeight: FontWeight.w900,
                    letterSpacing: 1,
                    color: Color(0xFF0B2240))),
            const SizedBox(height: 5),
            const Text('Live platform snapshot',
                style: TextStyle(color: Colors.black54, fontSize: 12)),
            const SizedBox(height: 16),
            if (loading) const LinearProgressIndicator(),
            if (error.isNotEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Text(error,
                      style: const TextStyle(color: Colors.red)),
                ),
              ),
            if (data != null) ...[
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                childAspectRatio: 1.6,
                mainAxisSpacing: 6,
                crossAxisSpacing: 6,
                children: [
                  metric('Customers', metrics['customers'] ?? 0, Icons.people),
                  metric('Providers', metrics['providers'] ?? 0, Icons.engineering),
                  metric('Online providers', metrics['onlineProviders'] ?? 0, Icons.location_on),
                  metric('Admins', metrics['activeAdmins'] ?? 0, Icons.admin_panel_settings),
                  metric('Bookings', metrics['bookings'] ?? 0, Icons.book_online),
                  metric('Active bookings', metrics['live'] ?? 0, Icons.pending_actions),
                  metric('Completed', metrics['completed'] ?? 0, Icons.task_alt),
                  metric('Cancelled', metrics['cancelled'] ?? 0, Icons.cancel),
                  metric('Revenue', money(metrics['revenue']), Icons.currency_rupee),
                  metric('Commission', money(metrics['commission']), Icons.account_balance_wallet),
                ],
              ),
              const SizedBox(height: 18),
              const Text('PENDING ACTIONS',
                  style: TextStyle(
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0B2240))),
              metric('Pending KYC', queues['pendingKyc'] ?? 0, Icons.verified_user),
              metric('Pending payments', queues['pendingPayments'] ?? 0, Icons.payments),
              metric('Open complaints', queues['pendingComplaints'] ?? 0, Icons.support_agent),
              metric('Pending payouts', queues['pendingPayouts'] ?? 0, Icons.account_balance),
              const SizedBox(height: 18),
              const Text('MANAGEMENT MODULES',
                  style: TextStyle(
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0B2240))),
              const SizedBox(height: 10),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: modules.length,
                gridDelegate:
                    const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  childAspectRatio: 1.05,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                ),
                itemBuilder: (context, index) {
                  final module = modules[index];
                  return Card(
                    clipBehavior: Clip.antiAlias,
                    child: InkWell(
                      onTap: () => openModule(module),
                      child: Padding(
                        padding: const EdgeInsets.all(8),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(module.icon,
                                color: const Color(0xFF0B2240), size: 26),
                            const SizedBox(height: 7),
                            Text(module.title,
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700)),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ],
            if (data == null && !loading && error.isEmpty)
              const Text('No dashboard data available.'),
            const SizedBox(height: 24),
            const Text('Kaamdaar · Owner-only access',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.black45, fontSize: 11)),
          ],
        ),
      ),
    );
  }
}

class _Module {
  final String title;
  final String collection;
  final IconData icon;
  const _Module(this.title, this.collection, this.icon);
}
