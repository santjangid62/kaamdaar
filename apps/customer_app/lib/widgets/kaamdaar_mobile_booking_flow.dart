import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';

/// Authenticated, server-backed booking flow embedded in the customer app Bot.
class KaamdaarMobileBookingFlow extends StatefulWidget {
  const KaamdaarMobileBookingFlow({super.key});
  @override
  State<KaamdaarMobileBookingFlow> createState() => _KaamdaarMobileBookingFlowState();
}

class _KaamdaarMobileBookingFlowState extends State<KaamdaarMobileBookingFlow> {
  int _step = 0;
  bool _busy = false;
  String? _error;
  String _mode = 'instant';
  String _date = _today();
  String _slot = 'ASAP';
  String? _bookingId;
  List<ServiceItem> _services = [];
  List<AddressItem> _addresses = [];
  List<Map<String, dynamic>> _slots = [];
  ServiceItem? _service;
  AddressItem? _address;

  static String _today() {
    final d = DateTime.now();
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  Future<void> _loadServices() async {
    setState(() { _busy = true; _error = null; });
    try {
      final user = await Api.restoreSession();
      if (user == null) throw Exception('बुकिंग के लिए पहले लॉगिन करें।');
      final all = await Api.catalog();
      if (!mounted) return;
      setState(() {
        _services = all.where((s) => s.parent.isEmpty).toList();
        _step = 1;
      });
    } catch (e) { if (mounted) setState(() => _error = e.toString()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _loadAddresses() async {
    setState(() { _busy = true; _error = null; });
    try {
      final user = await Api.restoreSession();
      if (user == null) throw Exception('बुकिंग के लिए पहले लॉगिन करें।');
      final list = await Api.addresses(user.id);
      if (!mounted) return;
      setState(() {
        _addresses = list;
        _address = list.where((a) => a.isDefault).firstOrNull ?? (list.isNotEmpty ? list.first : null);
        _step = 3;
      });
      if (list.isEmpty) setState(() => _error = 'पहले Profile में अपना saved address जोड़ें।');
    } catch (e) { if (mounted) setState(() => _error = e.toString()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _loadSlots() async {
    final a = _address;
    final s = _service;
    if (a == null || a.lat == null || a.lng == null || s == null) {
      setState(() => _error = 'इस saved address में map pin नहीं है। Profile में address location update करें।');
      return;
    }
    setState(() { _busy = true; _error = null; });
    try {
      final q = Uri(queryParameters: {'serviceId': s.id, 'date': _date, 'lat': '${a.lat}', 'lng': '${a.lng}'});
      final data = await Api.get('/api/booking-slots?${q.query}');
      final rows = (data['slots'] as List? ?? []).whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
      if (!mounted) return;
      setState(() { _slots = rows; _step = 4; if (rows.isEmpty) _error = 'इस तारीख को provider slot उपलब्ध नहीं है। दूसरी तारीख चुनें।'; });
    } catch (e) { if (mounted) setState(() => _error = e.toString()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Future<void> _confirmBooking() async {
    final s = _service; final a = _address;
    if (s == null || a == null || a.lat == null || a.lng == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      final booking = await Api.createBooking({
        'serviceId': s.id,
        'address': a.toJson(),
        'mode': _mode,
        'date': _date,
        'slot': _slot,
        'originPoint': {'lat': a.lat, 'lng': a.lng},
      });
      if (mounted) setState(() { _bookingId = booking.id; _step = 6; });
    } catch (e) { if (mounted) setState(() => _error = e.toString()); }
    finally { if (mounted) setState(() => _busy = false); }
  }

  Widget _action(String text, VoidCallback? onTap) => SizedBox(
    width: double.infinity, child: ElevatedButton(
      style: ElevatedButton.styleFrom(backgroundColor: KColors.flame, foregroundColor: KColors.navy),
      onPressed: _busy ? null : onTap, child: Text(text, style: const TextStyle(fontWeight: FontWeight.w800)),
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 8, 12, 4),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFFFF8E8), borderRadius: BorderRadius.circular(14), border: Border.all(color: KColors.flame.withValues(alpha: .5))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('Kaamdaar Bot · Booking', style: TextStyle(fontWeight: FontWeight.w800, color: KColors.navy)),
        const SizedBox(height: 8),
        if (_step == 0) _action('सेवा बुक करें', _loadServices),
        if (_step == 1) ...[
          const Text('कौन-सी सेवा चाहिए?'),
          ..._services.map((s) => ListTile(dense: true, contentPadding: EdgeInsets.zero, title: Text(s.name), subtitle: Text('शुरुआती कीमत ₹${s.price}'), trailing: const Icon(Icons.chevron_right), onTap: () => setState(() { _service = s; _step = 2; }))),
        ],
        if (_step == 2) ...[
          const Text('सेवा कब चाहिए?'),
          _action('अभी बुक करें', () { _mode = 'instant'; _date = _today(); _slot = 'ASAP'; _loadAddresses(); }),
          _action('Schedule करें', () { _mode = 'scheduled'; _loadAddresses(); }),
        ],
        if (_step == 3) ...[
          const Text('सेवा का पता चुनें'),
          ..._addresses.map((a) => RadioListTile<String>(dense: true, contentPadding: EdgeInsets.zero, value: a.id, groupValue: _address?.id, title: Text(a.label), subtitle: Text(a.oneLine), onChanged: (v) => setState(() => _address = _addresses.firstWhere((x) => x.id == v))),
          if (_mode == 'scheduled') ...[
            const SizedBox(height: 8),
            OutlinedButton.icon(onPressed: _busy ? null : () async {
              final picked = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 60)), initialDate: DateTime.now());
              if (picked != null) setState(() => _date = '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
            }, icon: const Icon(Icons.calendar_month), label: Text('तारीख: $_date')),
            _action('वास्तविक provider slots देखें', _loadSlots),
          ] else _action('आगे बढ़ें', () {
            if (_address?.lat == null || _address?.lng == null) { setState(() => _error = 'इस address में map pin नहीं है। Profile में location जोड़ें।'); return; }
            setState(() => _step = 5);
          }),
        ],
        if (_step == 4) ...[
          const Text('उपलब्ध समय चुनें'),
          ..._slots.map((s) => ListTile(dense: true, title: Text('${s['start']} – ${s['end']}'), subtitle: Text('Available providers: ${s['availableProviderCount']}'), onTap: () => setState(() { _slot = '${s['start']}'; _step = 5; }))),
        ],
        if (_step == 5) ...[
          const Text('Booking details जाँचें'),
          Text('${_service?.name ?? ''}\n${_mode == 'instant' ? 'अभी' : '$_date · $_slot'}\n${_address?.oneLine ?? ''}\nशुरुआती कीमत: ₹${_service?.price ?? 0}'),
          const SizedBox(height: 8),
          const Text('अंतिम कीमत server तय करेगा। Confirm करने पर provider dispatch request जाएगी।', style: TextStyle(fontSize: 12, color: Colors.black54)),
          _action('हाँ, booking confirm करें', _confirmBooking),
        ],
        if (_step == 6) ...[
          const Icon(Icons.check_circle, color: Colors.green, size: 28),
          const Text('आपकी booking request भेज दी गई है। Provider response का इंतज़ार करें।'),
          SelectableText('Booking ID: $_bookingId'),
          _action('नई booking', () => setState(() { _step = 0; _service = null; _address = null; _error = null; })),
        ],
        if (_busy) const LinearProgressIndicator(),
        if (_error != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 12))),
      ]),
    );
  }
}
