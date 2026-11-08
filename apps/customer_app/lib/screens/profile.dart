/// Profile — account, saved addresses (Indian PIN validated), help, logout.
library;
import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/models.dart';
import '../core/theme.dart';
import 'auth.dart';
import 'bookings.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  SessionUser? _user;
  List<BookingItem> _bookings = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final user = await Api.restoreSession();
      List<BookingItem> bookings = [];
      if (user != null) {
        try {
          bookings = await Api.userBookings(user.id);
        } catch (_) {}
      }
      if (!mounted) return;
      setState(() {
        _user = user;
        _bookings = bookings;
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _logout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Log out?'),
        content: const Text('You will need to verify your mobile number again.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: KColors.red),
            child: const Text('Log out'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    await Api.clearSession();
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: KColors.flame));
    }
    final u = _user;
    final done = _bookings.where((b) => b.status == 'completed').length;
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                    colors: [KColors.navy, Color(0xFF173A6B)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: Colors.white24,
                    child: Text(
                      (u?.name.isNotEmpty ?? false)
                          ? u!.name[0].toUpperCase()
                          : 'K',
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w900),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(u?.name ?? 'Guest',
                            style: const TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.w900)),
                        const SizedBox(height: 3),
                        Text('+91 ${u?.phone ?? ''}',
                            style: TextStyle(
                                color: Colors.white.withOpacity(.8), fontSize: 12.5)),
                        const SizedBox(height: 6),
                        Container(
                          padding:
                              const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                              color: KColors.green.withOpacity(.22),
                              borderRadius: BorderRadius.circular(999)),
                          child: const Text('Verified account',
                              style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _stat('Bookings', '${_bookings.length}', Icons.receipt_long),
                const SizedBox(width: 10),
                _stat('Completed', '$done', Icons.check_circle),
                const SizedBox(width: 10),
                _stat('Rating', '4.8', Icons.star),
              ],
            ),
            const SizedBox(height: 18),
            _tile(Icons.receipt_long, 'My Bookings', () {
              Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const BookingsScreen()));
            }),
            _tile(Icons.location_on_outlined, 'Saved Addresses', () async {
              await Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const AddressesScreen()));
              _load();
            }),
            _tile(Icons.notifications_none, 'Notifications', () {
              _soon();
            }),
            _tile(Icons.payment, 'Payment Methods', () {
              _soon();
            }),
            _tile(Icons.help_outline, 'Help & Support', () async {
              await showDialog<void>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Help & Support'),
                  content: const Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('• Track any booking from Bookings tab'),
                      SizedBox(height: 6),
                      Text('• Need a Pro urgently? Book with ASAP slot'),
                      SizedBox(height: 6),
                      Text('• Cancellations are free before the Pro starts'),
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
            _tile(Icons.description_outlined, 'Terms & Privacy', () {
              _soon();
            }),
            const SizedBox(height: 8),
            _tile(Icons.logout, 'Logout', _logout, danger: true),
          ],
        ),
      ),
    );
  }

  void _soon() => ScaffoldMessenger.of(context)
      .showSnackBar(const SnackBar(content: Text('Coming soon')));

  Widget _stat(String label, String value, IconData icon) {
    return Expanded(
      child: CardBox(
        padding: const EdgeInsets.symmetric(vertical: 14),
        child: Column(
          children: [
            Icon(icon, size: 18, color: KColors.flame),
            const SizedBox(height: 6),
            Text(value,
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16)),
            Text(label,
                style: const TextStyle(fontSize: 11, color: Colors.black45)),
          ],
        ),
      ),
    );
  }

  Widget _tile(IconData icon, String label, VoidCallback onTap,
      {bool danger = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: CardBox(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
        onTap: onTap,
        child: ListTile(
          contentPadding: EdgeInsets.zero,
          leading: Icon(icon, color: danger ? KColors.red : KColors.navy, size: 22),
          title: Text(label,
              style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: danger ? KColors.red : Colors.black87)),
          trailing: const Icon(Icons.chevron_right, color: Colors.black38, size: 20),
        ),
      ),
    );
  }
}

/* ----------------------- saved addresses ----------------------- */

/// Indian PIN: 6 digits, never starting with 0.
String? validatePincode(String? v) {
  final p = (v ?? '').trim();
  if (p.isEmpty) return 'PIN code is required';
  if (!RegExp(r'^[1-9][0-9]{5}$').hasMatch(p)) return 'Enter a valid 6-digit Indian PIN';
  return null;
}

class AddressesScreen extends StatefulWidget {
  const AddressesScreen({super.key});

  @override
  State<AddressesScreen> createState() => _AddressesScreenState();
}

class _AddressesScreenState extends State<AddressesScreen> {
  List<AddressItem> _list = [];
  SessionUser? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final user = await Api.restoreSession();
    if (user == null) {
      setState(() {
        _loading = false;
        _user = null;
      });
      return;
    }
    try {
      final list = await Api.addresses(user.id);
      if (!mounted) return;
      setState(() {
        _user = user;
        _list = list;
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _add() async {
    final user = _user;
    if (user == null) return;
    final added = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: AddressForm(
          onSave: (body) async {
            await Api.addAddress(user.id, body);
            return true;
          },
        ),
      ),
    );
    if (added == true) _load();
  }

  Future<void> _delete(AddressItem a) async {
    final user = _user;
    if (user == null) return;
    try {
      await Api.deleteAddress(user.id, a.id);
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
    return Scaffold(
      appBar: AppBar(title: const Text('Saved Addresses')),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: KColors.flame))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_list.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 40),
                    child: Column(
                      children: [
                        Icon(Icons.location_off_outlined, size: 44, color: Colors.black26),
                        SizedBox(height: 8),
                        Text('No saved addresses yet',
                            style: TextStyle(color: Colors.black45)),
                      ],
                    ),
                  )
                else
                  ..._list.map((a) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: CardBox(
                          child: Row(
                            children: [
                              Icon(
                                  a.label.toLowerCase() == 'office'
                                      ? Icons.work_outline
                                      : Icons.home_outlined,
                                  color: KColors.flame),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(a.label,
                                            style: const TextStyle(
                                                fontWeight: FontWeight.w800,
                                                fontSize: 14)),
                                        if (a.isDefault)
                                          const Padding(
                                            padding: EdgeInsets.only(left: 6),
                                            child: Text('• Default',
                                                style: TextStyle(
                                                    fontSize: 11,
                                                    color: KColors.green)),
                                          ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(a.oneLine,
                                        style: const TextStyle(
                                            color: Colors.black54, fontSize: 12.5)),
                                  ],
                                ),
                              ),
                              IconButton(
                                onPressed: () => _delete(a),
                                icon: const Icon(Icons.delete_outline,
                                    color: KColors.red, size: 20),
                              ),
                            ],
                          ),
                        ),
                      )),
                const SizedBox(height: 10),
                PrimaryBtn(label: 'Add New Address', icon: Icons.add, onPressed: _add),
              ],
            ),
    );
  }
}

/// Address form with Indian PIN validation and optional map coordinates.
class AddressForm extends StatefulWidget {
  final Future<bool> Function(Map<String, dynamic>) onSave;
  const AddressForm({super.key, required this.onSave});

  @override
  State<AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends State<AddressForm> {
  final _form = GlobalKey<FormState>();
  final _label = TextEditingController(text: 'Home');
  final _line1 = TextEditingController();
  final _line2 = TextEditingController();
  final _city = TextEditingController(text: 'Jaipur');
  final _pincode = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    for (final c in [_label, _line1, _line2, _city, _pincode]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _busy = true);
    try {
      final ok = await widget.onSave({
        'label': _label.text.trim(),
        'line1': _line1.text.trim(),
        if (_line2.text.trim().isNotEmpty) 'line2': _line2.text.trim(),
        'city': _city.text.trim(),
        'pincode': _pincode.text.trim(),
        'lat': 26.9124,
        'lng': 75.7873,
        'isDefault': false,
      });
      if (ok && mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
      child: Form(
        key: _form,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Add Address',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              initialValue: 'Home',
              items: const ['Home', 'Office', 'Other']
                  .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                  .toList(),
              onChanged: (v) => _label.text = v ?? 'Home',
              decoration: const InputDecoration(labelText: 'Address type'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _line1,
              decoration: const InputDecoration(
                  labelText: 'House / Flat / Street',
                  hintText: 'e.g. 125, Malviya Nagar'),
              validator: (v) =>
                  (v ?? '').trim().length < 4 ? 'Enter your street address' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _line2,
              decoration: const InputDecoration(
                  labelText: 'Area / Landmark (optional)'),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _city,
                    decoration: const InputDecoration(labelText: 'City'),
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'City is required' : null,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    controller: _pincode,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: const InputDecoration(
                        labelText: 'PIN code', counterText: ''),
                    validator: validatePincode,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            const Text('Only valid 6-digit Indian PIN codes are accepted.',
                style: TextStyle(fontSize: 11, color: Colors.black45)),
            const SizedBox(height: 14),
            PrimaryBtn(label: 'Save Address', busy: _busy, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}
