/// Provider shell — dashboard (live request inbox), jobs, wallet, profile.
library;

import 'dart:async';

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/job_alerts.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'auth.dart';
import 'job.dart';

class ProviderShell extends StatefulWidget {
  const ProviderShell({super.key});

  @override
  State<ProviderShell> createState() => _ProviderShellState();
}

class _ProviderShellState extends State<ProviderShell> {
  int _tab = 0;

  @override
  void initState() {
    super.initState();
    _watchOffers();
  }

  /// Starts the app-wide offer watcher: a new dispatch rings over whichever
  /// tab is open, not only the dashboard.
  Future<void> _watchOffers() async {
    final user = await Api.restoreSession();
    if (user == null) return;
    try {
      final me = await Api.me(user.phone);
      if (me == null) return;
      await JobAlertCenter.instance.start(user: user, me: me);
    } catch (_) {
      // The dashboard's own retry will surface connectivity problems.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _tab,
        children: const [
          DashboardTab(),
          JobsTab(),
          WalletTab(),
          ProfileTab(),
        ],
      ),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _tab,
        onTap: (i) => setState(() => _tab = i),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: PColors.green,
        unselectedItemColor: Colors.black45,
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11.5),
        items: const [
          BottomNavigationBarItem(
              icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(
              icon: Icon(Icons.work_outline), activeIcon: Icon(Icons.work), label: 'Jobs'),
          BottomNavigationBarItem(
              icon: Icon(Icons.account_balance_wallet_outlined),
              activeIcon: Icon(Icons.account_balance_wallet),
              label: 'Wallet'),
          BottomNavigationBarItem(
              icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

/// Shared state for the signed-in Pro (loaded once, refreshed by each tab).
class ProviderState {
  static ProviderItem? provider;
  static SessionUser? user;
}

/* ------------------------------ dashboard ------------------------------ */

class DashboardTab extends StatefulWidget {
  const DashboardTab({super.key});

  @override
  State<DashboardTab> createState() => _DashboardTabState();
}

class _DashboardTabState extends State<DashboardTab> {
  ProviderItem? _me;
  SessionUser? _user;
  List<BookingItem> _offers = [];
  List<BookingItem> _active = [];
  List<BookingItem> _all = [];
  WalletInfo? _wallet;
  bool _available = true;
  bool _loading = true;
  String? _error;
  Timer? _ticker;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    _load();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && _offers.isNotEmpty) setState(() {});
    });
    _poll = Timer.periodic(const Duration(seconds: 5), (_) => _load(silent: true));
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _poll?.cancel();
    super.dispose();
  }

  Future<void> _load({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final user = await Api.restoreSession();
      if (user == null) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = 'Please log in again.';
        });
        return;
      }
      final me = await Api.me(user.phone);
      if (me == null) {
        if (!mounted) return;
        Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute(builder: (_) => RegistrationScreen(user: user)),
            (route) => false);
        return;
      }
      final jobs = await Api.inbox(me.id);
      WalletInfo? wallet;
      try {
        wallet = await Api.wallet(me.id);
      } catch (_) {}
      if (!mounted) return;
      ProviderState.provider = me;
      ProviderState.user = user;
      setState(() {
        _user = user;
        _me = me;
        _all = jobs;
        _offers = jobs
            .where((b) => b.status == 'dispatched' && b.notifiedIds.contains(me.id))
            .toList();
        _active = jobs.where((b) => b.providerId == me.id && b.isLive).toList();
        _wallet = wallet;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _accept(BookingItem b) async {
    final me = _me;
    if (me == null) return;
    try {
      final updated = await Api.accept(b, me);
      if (!mounted) return;
      await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => JobDetailScreen(bookingId: updated.id, provider: me)));
      _load();
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString().contains('already accepted')
          ? 'Someone else accepted this job first'
          : e.toString();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
      // the server withdrew the offer — refresh so it leaves Offers at once
      _load(silent: true);
    }
  }

  Future<void> _decline(BookingItem b) async {
    final me = _me;
    if (me == null) return;
    try {
      await Api.decline(b, me.id);
      if (mounted) setState(() => _offers.removeWhere((o) => o.id == b.id));
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  int get _todayJobs {
    final now = DateTime.now();
    return _all
        .where((b) =>
            b.providerId == _me?.id &&
            b.status == 'completed' &&
            b.acceptedAt != null &&
            DateTime.fromMillisecondsSinceEpoch(b.acceptedAt!).day == now.day)
        .length;
  }

  int get _todayEarnings {
    final now = DateTime.now();
    return _all
        .where((b) =>
            b.providerId == _me?.id &&
            b.status == 'completed' &&
            b.acceptedAt != null &&
            DateTime.fromMillisecondsSinceEpoch(b.acceptedAt!).day == now.day)
        .fold<int>(0, (sum, b) => sum + b.amount - commissionOf(b.amount));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: PColors.green));
    }
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off, size: 40, color: Colors.black26),
              const SizedBox(height: 10),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 14),
              GhostBtn(label: 'Retry', onPressed: _load, color: PColors.green),
            ],
          ),
        ),
      );
    }
    final me = _me!;
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 26),
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Good Morning, ${_user?.firstName.isNotEmpty == true ? _user!.firstName : me.name.split(' ').first}!',
                          style: const TextStyle(
                              fontSize: 17, fontWeight: FontWeight.w900, color: PColors.ink)),
                      const SizedBox(height: 2),
                      Text(me.city.isEmpty ? 'Jaipur, Rajasthan' : me.city,
                          style: const TextStyle(fontSize: 12, color: Colors.black45)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.all(9),
                  decoration: BoxDecoration(
                      color: PColors.green.withValues(alpha: .12),
                      shape: BoxShape.circle),
                  child: const Icon(Icons.handyman, color: PColors.green),
                ),
              ],
            ),
            const SizedBox(height: 14),

            /* availability */
            CardBox(
              child: Row(
                children: [
                  Container(
                    height: 38,
                    width: 38,
                    decoration: BoxDecoration(
                      color: (_available ? PColors.green : Colors.grey).withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.power_settings_new,
                        size: 20, color: _available ? PColors.green : Colors.grey),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_available ? 'Online — receiving requests' : 'Offline',
                            style: const TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 13.5)),
                        const Text('Naye requests lene ke liye online rahein',
                            style: TextStyle(fontSize: 11.5, color: Colors.black45)),
                      ],
                    ),
                  ),
                  Switch(
                    value: _available,
                    activeThumbColor: PColors.green,
                    onChanged: (v) => setState(() => _available = v),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            /* today stats */
            CardBox(
              child: Row(
                children: [
                  _stat('Today', '$_todayJobs', 'Jobs'),
                  _divider(),
                  _stat('Earnings', rupees(_todayEarnings), 'Today'),
                  _divider(),
                  _stat('Rating', me.rating.toStringAsFixed(1), '${me.reviewCount} rev'),
                  _divider(),
                  _stat('Wallet', rupees(_wallet?.balance ?? 0), 'Balance'),
                ],
              ),
            ),
            const SizedBox(height: 18),

            /* jobs this Pro let go today */
            ValueListenableBuilder<List<MissedJob>>(
              valueListenable: JobAlertCenter.instance.missed,
              builder: (context, history, _) {
                final today = history.where((m) => m.isToday).toList();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: CardBox(
                    borderColor: today.isEmpty
                        ? PColors.ink.withValues(alpha: .06)
                        : PColors.red.withValues(alpha: .35),
                    child: Row(
                      children: [
                        Container(
                          height: 38,
                          width: 38,
                          decoration: BoxDecoration(
                            color: (today.isEmpty ? Colors.black : PColors.red)
                                .withValues(alpha: .08),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(Icons.notifications_off_outlined,
                              size: 19,
                              color: today.isEmpty ? Colors.black38 : PColors.red),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  const Text('Aaj accept nahi kiye',
                                      style: TextStyle(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13.5)),
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 7, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: (today.isEmpty
                                              ? Colors.black12
                                              : PColors.red)
                                          .withValues(alpha: .12),
                                      borderRadius: BorderRadius.circular(999),
                                    ),
                                    child: Text('${today.length}',
                                        style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w900,
                                            color: today.isEmpty
                                                ? Colors.black54
                                                : PColors.red)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 2),
                              Text(
                                today.isEmpty
                                    ? 'Sab offers par reply kiya — aise hi chalte rahein.'
                                    : _missedLine(today),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 11.5, color: Colors.black45),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),

            if (!me.verified)
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: PColors.amber.withValues(alpha: .16),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.verified_user_outlined,
                        color: Color(0xFFB45309), size: 18),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'KYC ${me.kycStatus} — admin approval ke baad profile par verified badge aayega.',
                        style: const TextStyle(fontSize: 11.5, color: Color(0xFF7C2D12)),
                      ),
                    ),
                  ],
                ),
              ),

            Row(
              children: [
                const Text('New Service Requests',
                    style: TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 15, color: PColors.ink)),
                const SizedBox(width: 8),
                if (_offers.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                        color: PColors.red, borderRadius: BorderRadius.circular(999)),
                    child: Text('${_offers.length}',
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w800)),
                  ),
                const Spacer(),
                TextButton(onPressed: () => _load(), child: const Text('Refresh')),
              ],
            ),
            const SizedBox(height: 4),
            if (_offers.isEmpty)
              CardBox(
                child: Row(
                  children: [
                    const Icon(Icons.notifications_none, color: Colors.black38),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'Abhi koi request nahi. Online rahein — aapke 3 km radius me booking aate hi yahan aa jayegi.',
                        style: TextStyle(fontSize: 12, color: Colors.black.withValues(alpha: .55)),
                      ),
                    ),
                  ],
                ),
              )
            else
              ..._offers.map((b) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _OfferCard(
                      booking: b,
                      onAccept: () => _accept(b),
                      onDecline: () => _decline(b),
                    ),
                  )),

            if (_active.isNotEmpty) ...[
              const SizedBox(height: 14),
              const Text('Ongoing Job',
                  style: TextStyle(
                      fontWeight: FontWeight.w900, fontSize: 15, color: PColors.ink)),
              const SizedBox(height: 8),
              ..._active.map((b) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: CardBox(
                      onTap: () async {
                        await Navigator.of(context).push(MaterialPageRoute(
                            builder: (_) =>
                                JobDetailScreen(bookingId: b.id, provider: me)));
                        _load();
                      },
                      borderColor: PColors.green.withValues(alpha: .4),
                      child: Row(
                        children: [
                          const Icon(Icons.work_history, color: PColors.green),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(b.serviceName,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w800, fontSize: 13.5)),
                                Text(b.address.oneLine,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 11.5, color: Colors.black45)),
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

  /// "2 reject · 1 no-reply — last: AC Repair"
  String _missedLine(List<MissedJob> today) {
    final rejected = today.where((m) => !m.expired).length;
    final expired = today.length - rejected;
    final parts = [
      if (rejected > 0) '$rejected reject',
      if (expired > 0) '$expired no-reply',
    ];
    return '${parts.join(' · ')} — last: ${today.last.service}';
  }

  Widget _divider() => Container(
      height: 34,
      width: 1,
      margin: const EdgeInsets.symmetric(horizontal: 6),
      color: const Color(0xFFEDF2F0));

  Widget _stat(String label, String value, String sub) {
    return Expanded(
      child: Column(
        children: [
          Text(label,
              style: const TextStyle(fontSize: 10.5, color: Colors.black45)),
          const SizedBox(height: 2),
          Text(value,
              style: const TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w900, color: PColors.ink)),
          Text(sub, style: const TextStyle(fontSize: 10, color: Colors.black38)),
        ],
      ),
    );
  }
}

/// Offer with the mockup's accept/decline + countdown.
class _OfferCard extends StatelessWidget {
  final BookingItem booking;
  final VoidCallback onAccept;
  final VoidCallback onDecline;

  const _OfferCard({
    required this.booking,
    required this.onAccept,
    required this.onDecline,
  });

  @override
  Widget build(BuildContext context) {
    final seconds = ((booking.createdAt + 60000 - DateTime.now().millisecondsSinceEpoch) /
            1000)
        .clamp(0, 60)
        .round();
    final me = booking.amount;
    return CardBox(
      borderColor: PColors.flame.withValues(alpha: .4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                height: 40,
                width: 40,
                decoration: BoxDecoration(
                  color: PColors.flame.withValues(alpha: .12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.home_repair_service,
                    color: PColors.flame, size: 20),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(booking.serviceName,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 14)),
                    Text(booking.phone.isEmpty ? '' : '+91 ${booking.phone}',
                        style: const TextStyle(fontSize: 11.5, color: Colors.black45)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: seconds <= 15
                      ? PColors.red.withValues(alpha: .12)
                      : Colors.black.withValues(alpha: .06),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  children: [
                    Icon(Icons.timer_outlined,
                        size: 12,
                        color: seconds <= 15 ? PColors.red : Colors.black54),
                    const SizedBox(width: 3),
                    Text('${seconds}s',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: seconds <= 15 ? PColors.red : Colors.black54)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.location_on_outlined, size: 14, color: Colors.black45),
              const SizedBox(width: 4),
              Expanded(
                child: Text(booking.address.oneLine,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.event_outlined, size: 14, color: Colors.black45),
              const SizedBox(width: 4),
              Text('${booking.date} • ${booking.slot}',
                  style: const TextStyle(fontSize: 11.5, color: Colors.black54)),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Text('You earn',
                  style: TextStyle(fontSize: 11.5, color: Colors.black45)),
              const SizedBox(width: 6),
              Text(rupees(me - commissionOf(me)),
                  style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 15,
                      color: PColors.green)),
              const SizedBox(width: 4),
              Text('(${rupees(me)} − 10%)',
                  style: const TextStyle(fontSize: 10.5, color: Colors.black38)),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 44,
                  child: OutlinedButton(
                    onPressed: onDecline,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: PColors.red,
                      side: BorderSide(color: PColors.red.withValues(alpha: .5)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Decline',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: SizedBox(
                  height: 44,
                  child: ElevatedButton(
                    onPressed: onAccept,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: PColors.green,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('Accept',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/* -------------------------------- jobs -------------------------------- */

class JobsTab extends StatefulWidget {
  const JobsTab({super.key});

  @override
  State<JobsTab> createState() => _JobsTabState();
}

class _JobsTabState extends State<JobsTab> {
  int _filter = 0;
  List<BookingItem> _jobs = [];
  ProviderItem? _me;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = await Api.restoreSession();
      if (user == null) return;
      final me = await Api.me(user.phone);
      if (me == null) return;
      final jobs = await Api.inbox(me.id);
      if (!mounted) return;
      setState(() {
        _me = me;
        _jobs = jobs.where((b) => b.providerId == me.id).toList();
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final view = _filter == 0 ? _jobs.where((b) => b.isLive).toList() : _jobs.where((b) => !b.isLive).toList();
    return SafeArea(
      child: Column(
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Align(
              alignment: Alignment.centerLeft,
              child: Text('My Jobs',
                  style: TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w900, color: PColors.ink)),
            ),
          ),
          Row(
            children: ['Ongoing', 'Completed'].asMap().entries.map((e) {
              final active = _filter == e.key;
              return Padding(
                padding: const EdgeInsets.only(right: 8, left: 8),
                child: ChoiceChip(
                  label: Text(e.value),
                  selected: active,
                  selectedColor: PColors.green,
                  labelStyle: TextStyle(
                      color: active ? Colors.white : Colors.black54,
                      fontWeight: FontWeight.w700,
                      fontSize: 12),
                  onSelected: (_) => setState(() => _filter = e.key),
                ),
              );
            }).toList(),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _loading
                  ? const Center(child: CircularProgressIndicator(color: PColors.green))
                  : view.isEmpty
                      ? ListView(
                          padding: const EdgeInsets.all(30),
                          children: const [
                            SizedBox(height: 60),
                            Icon(Icons.work_off_outlined, size: 44, color: Colors.black26),
                            SizedBox(height: 8),
                            Center(
                                child: Text('No jobs here yet',
                                    style: TextStyle(color: Colors.black45))),
                          ],
                        )
                      : ListView(
                          padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                          children: view
                              .map((b) => Padding(
                                    padding: const EdgeInsets.only(bottom: 10),
                                    child: CardBox(
                                      onTap: () async {
                                        await Navigator.of(context).push(
                                            MaterialPageRoute(
                                                builder: (_) => JobDetailScreen(
                                                    bookingId: b.id,
                                                    provider: _me)));
                                        _load();
                                      },
                                      child: Row(
                                        children: [
                                          Container(
                                            height: 40,
                                            width: 40,
                                            decoration: BoxDecoration(
                                              color: jobStatusColor(b.status)
                                                  .withValues(alpha: .12),
                                              borderRadius: BorderRadius.circular(10),
                                            ),
                                            child: Icon(Icons.handyman,
                                                size: 20,
                                                color: jobStatusColor(b.status)),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(b.serviceName,
                                                    style: const TextStyle(
                                                        fontWeight: FontWeight.w800,
                                                        fontSize: 13.5)),
                                                Text('${b.date} • ${b.slot}',
                                                    style: const TextStyle(
                                                        fontSize: 11.5,
                                                        color: Colors.black45)),
                                              ],
                                            ),
                                          ),
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            children: [
                                              Text(rupees(b.amount),
                                                  style: const TextStyle(
                                                      fontWeight: FontWeight.w900,
                                                      fontSize: 14,
                                                      color: PColors.ink)),
                                              const SizedBox(height: 3),
                                              StatusChip(status: b.status),
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

/* ------------------------------- wallet -------------------------------- */

class WalletTab extends StatefulWidget {
  const WalletTab({super.key});

  @override
  State<WalletTab> createState() => _WalletTabState();
}

class _WalletTabState extends State<WalletTab> {
  ProviderItem? _me;
  WalletInfo? _wallet;
  List<WalletTxn> _txns = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final user = await Api.restoreSession();
      if (user == null) return;
      final me = await Api.me(user.phone);
      if (me == null) return;
      final wallet = await Api.wallet(me.id);
      final txns = await Api.walletTxns(me.id);
      if (!mounted) return;
      setState(() {
        _me = me;
        _wallet = wallet;
        _txns = txns;
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _recharge() async {
    final me = _me;
    if (me == null) return;
    final ctrl = TextEditingController(text: '500');
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add money to wallet'),
        content: TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          decoration: const InputDecoration(prefixText: '₹ ', labelText: 'Amount'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: PColors.green),
            child: const Text('Add'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final amount = int.tryParse(ctrl.text.trim()) ?? 0;
    if (amount <= 0) return;
    try {
      await Api.recharge(me.id, amount);
      _load();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: PColors.green));
    }
    final balance = _wallet?.balance ?? 0;
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 26),
          children: [
            const Text('My Wallet',
                style: TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w900, color: PColors.ink)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                    colors: [PColors.greenDark, PColors.green],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Total Balance',
                      style: TextStyle(color: Colors.white70, fontSize: 12)),
                  const SizedBox(height: 4),
                  Text(rupees(balance),
                      style: const TextStyle(
                          color: Colors.white, fontSize: 30, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _recharge,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Colors.white54),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Add money',
                              style: TextStyle(fontSize: 12.5)),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Minimum balance ₹500 — 10% commission is debited after every paid job.',
                      style: TextStyle(
                          color: Colors.white.withValues(alpha: .8), fontSize: 10.5)),
                ],
              ),
            ),
            const SizedBox(height: 18),
            const Text('Recent Transactions',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
            const SizedBox(height: 8),
            if (_txns.isEmpty)
              const CardBox(
                  child: Text('No transactions yet',
                      style: TextStyle(color: Colors.black45, fontSize: 12.5)))
            else
              ..._txns.take(20).map((t) {
                final credit = t.amount >= 0;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: CardBox(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                    child: Row(
                      children: [
                        Icon(credit ? Icons.arrow_downward : Icons.arrow_upward,
                            size: 18, color: credit ? PColors.green : PColors.red),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(t.note.isEmpty ? t.kind : t.note,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w700, fontSize: 12.5)),
                              Text(
                                  DateTime.fromMillisecondsSinceEpoch(t.createdAt)
                                      .toString()
                                      .split('.')
                                      .first,
                                  style: const TextStyle(
                                      fontSize: 10.5, color: Colors.black38)),
                            ],
                          ),
                        ),
                        Text('${credit ? '+' : '−'}${rupees(t.amount.abs())}',
                            style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                color: credit ? PColors.green : PColors.red)),
                      ],
                    ),
                  ),
                );
              }),
          ],
        ),
      ),
    );
  }
}

/* ------------------------------- profile -------------------------------- */

class ProfileTab extends StatefulWidget {
  const ProfileTab({super.key});

  @override
  State<ProfileTab> createState() => _ProfileTabState();
}

class _ProfileTabState extends State<ProfileTab> {
  ProviderItem? _me;
  SessionUser? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user = await Api.restoreSession();
      if (user == null) return;
      final me = await Api.me(user.phone);
      if (!mounted) return;
      setState(() {
        _user = user;
        _me = me;
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    // Stop ringing offers and polling once the Pro is signed out.
    JobAlertCenter.instance.stop();
    await Api.clearSession();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => const LoginScreen()), (route) => false);
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: PColors.green));
    }
    final me = _me;
    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 26),
        children: [
          CardBox(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: PColors.green.withValues(alpha: .14),
                  child: Text(
                    (me?.name.isNotEmpty ?? false) ? me!.name[0].toUpperCase() : 'P',
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w900, color: PColors.green),
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(me?.name ?? 'Professional',
                          style: const TextStyle(
                              fontWeight: FontWeight.w900, fontSize: 16)),
                      const SizedBox(height: 2),
                      Text('+91 ${_user?.phone ?? ''}',
                          style:
                              const TextStyle(fontSize: 12, color: Colors.black45)),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.star, size: 14, color: PColors.amber),
                          Text(' ${me?.rating.toStringAsFixed(1) ?? '0.0'}',
                              style: const TextStyle(
                                  fontSize: 12, fontWeight: FontWeight.w700)),
                          Text(' • ${me?.jobs ?? 0} jobs',
                              style: const TextStyle(
                                  fontSize: 11.5, color: Colors.black45)),
                        ],
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: (me?.verified ?? false)
                        ? PColors.green.withValues(alpha: .14)
                        : PColors.amber.withValues(alpha: .2),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    (me?.verified ?? false) ? 'Verified' : 'KYC ${me?.kycStatus ?? ''}',
                    style: TextStyle(
                        fontSize: 10.5,
                        fontWeight: FontWeight.w800,
                        color: (me?.verified ?? false)
                            ? PColors.green
                            : const Color(0xFF92400E)),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          CardBox(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Services you provide',
                    style: TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: (me?.services ?? [])
                      .map((s) => Chip(
                            label: Text(s, style: const TextStyle(fontSize: 11)),
                            backgroundColor: PColors.green.withValues(alpha: .1),
                            side: BorderSide.none,
                          ))
                      .toList(),
                ),
                const Divider(height: 22),
                Row(
                  children: [
                    const Icon(Icons.location_on_outlined, size: 16, color: Colors.black45),
                    const SizedBox(width: 6),
                    Expanded(
                        child: Text(me?.city ?? '—',
                            style: const TextStyle(fontSize: 12.5))),
                  ],
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.workspace_premium_outlined,
                        size: 16, color: Colors.black45),
                    const SizedBox(width: 6),
                    Text('${me?.experience ?? 0} years experience',
                        style: const TextStyle(fontSize: 12.5)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          _tile(Icons.help_outline, 'Help & Support', () {
            showDialog<void>(
              context: context,
              builder: (ctx) => AlertDialog(
                title: const Text('Help & Support'),
                content: const Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('• Accept request within 60 seconds'),
                    SizedBox(height: 6),
                    Text('• Start OTP customer se lein'),
                    SizedBox(height: 6),
                    Text('• Commission 10% har paid job par'),
                    SizedBox(height: 10),
                    Text('support@kaamdaar.in',
                        style: TextStyle(fontWeight: FontWeight.w700)),
                  ],
                ),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
                ],
              ),
            );
          }),
          _tile(Icons.logout, 'Logout', _logout, danger: true),
        ],
      ),
    );
  }

  Widget _tile(IconData icon, String label, VoidCallback onTap,
      {bool danger = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: CardBox(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        onTap: onTap,
        child: ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon, color: danger ? PColors.red : PColors.ink, size: 21),
          title: Text(label,
              style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w700,
                  color: danger ? PColors.red : Colors.black87)),
          trailing: const Icon(Icons.chevron_right, size: 20, color: Colors.black38),
        ),
      ),
    );
  }
}
