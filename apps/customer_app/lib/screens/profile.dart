/// Profile — account, saved addresses (Indian PIN validated), help, logout.
library;
import 'dart:convert';
import 'package:image_picker/image_picker.dart';
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
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _loadError = null;
      });
    }
    SessionUser? user;
    try {
      user = await Api.restoreSession();
      if (user != null) {
        try { user = await Api.refreshProfile(user.phone); } catch (_) {}
      }
      final bookings = user == null
          ? <BookingItem>[]
          : await Api.userBookings(user.id);
      if (!mounted) return;
      setState(() {
        _user = user;
        _bookings = bookings;
        _loadError = null;
      });
    } catch (error) {
      if (mounted) {
        setState(() {
          _user = user;
          _loadError = error.toString();
        });
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickProfilePhoto() async {
    final current = _user;
    if (current == null) return;
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 640,
        maxHeight: 640,
        imageQuality: 78,
      );
      if (picked == null) return;
      final bytes = await picked.readAsBytes();
      final encoded = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      final updated = await Api.updateProfile(current.id, {'photo': encoded});
      if (!mounted) return;
      setState(() => _user = updated);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile photo saved successfully')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not save profile photo: $e')),
      );
    }
  }

  Future<void> _pairBrowser() async {
    try {
      final result = await Api.createPairingCode();
      final code = (result['code'] ?? '').toString();
      if (!mounted || code.isEmpty) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Pair this browser'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text('Enter this one-time code on the Kaamdaar website. It expires in 3 minutes.'),
              const SizedBox(height: 18),
              SelectableText(code, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: 8)),
            ],
          ),
          actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
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
    final displayName = (u?.name.trim().isNotEmpty ?? false) ? u!.name.trim() : 'Guest';
    return SafeArea(
      child: RefreshIndicator(
        onRefresh: _load,
        color: KColors.flame,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 30),
          children: [
            if (_loadError != null)
              CardBox(
                borderColor: Colors.red.shade200,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(children: [
                      Icon(Icons.cloud_off_outlined, color: KColors.red, size: 20),
                      SizedBox(width: 8),
                      Expanded(child: Text('Could not refresh your profile',
                          style: TextStyle(fontWeight: FontWeight.w800, color: KColors.red))),
                    ]),
                    const SizedBox(height: 6),
                    Text(_loadError!, style: const TextStyle(fontSize: 12, color: Colors.black54)),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: _load,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Try again'),
                      ),
                    ),
                  ],
                ),
              ),
            Container(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0B2240), Color(0xFF1B4778), Color(0xFF24558A)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(26),
                boxShadow: [
                  BoxShadow(color: KColors.navy.withOpacity(.18), blurRadius: 22, offset: const Offset(0, 10)),
                ],
              ),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: _pickProfilePhoto,
                    child: Stack(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(3),
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white.withOpacity(.75), width: 2),
                          ),
                          child: CircleAvatar(
                            radius: 34,
                            backgroundColor: Colors.white.withOpacity(.16),
                            backgroundImage: _profileImage(u?.photo ?? ''),
                            child: (u?.photo.isNotEmpty ?? false)
                                ? null
                                : Text(displayName.isNotEmpty ? displayName[0].toUpperCase() : 'K',
                                    style: const TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          bottom: 1,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: const BoxDecoration(color: KColors.flame, shape: BoxShape.circle),
                            child: const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 14),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 15),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(displayName, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800, letterSpacing: .1)),
                        const SizedBox(height: 5),
                        Text('+91 ${u?.phone ?? ''}',
                          style: TextStyle(color: Colors.white.withOpacity(.82), fontSize: 13, fontWeight: FontWeight.w500)),
                        const SizedBox(height: 10),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                          decoration: BoxDecoration(
                            color: KColors.green.withOpacity(.20),
                            border: Border.all(color: Colors.white.withOpacity(.18)),
                            borderRadius: BorderRadius.circular(30),
                          ),
                          child: const Row(mainAxisSize: MainAxisSize.min, children: [
                            Icon(Icons.verified_rounded, color: Color(0xFF86EFAC), size: 14),
                            SizedBox(width: 5),
                            Text('Verified account', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                          ]),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Change profile photo',
                    onPressed: _pickProfilePhoto,
                    icon: const Icon(Icons.edit_outlined, color: Colors.white70, size: 19),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 22),
            const Padding(
              padding: EdgeInsets.only(left: 2, bottom: 11),
              child: Text('YOUR ACTIVITY', style: TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.15)),
            ),
            Row(
              children: [
                _stat('Bookings', '${_bookings.length}', Icons.receipt_long_rounded, const Color(0xFFFF7A00)),
                const SizedBox(width: 10),
                _stat('Completed', '$done', Icons.check_circle_rounded, const Color(0xFF16A34A)),
                const SizedBox(width: 10),
                _stat('Rating', '4.8', Icons.star_rounded, const Color(0xFFF59E0B)),
              ],
            ),
            const SizedBox(height: 24),
            const Padding(
              padding: EdgeInsets.only(left: 2, bottom: 11),
              child: Text('ACCOUNT & PREFERENCES', style: TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.15)),
            ),
            _tile(Icons.receipt_long_rounded, 'My Bookings', 'View and track your services', () {
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => const BookingsScreen()));
            }),
            _tile(Icons.location_on_outlined, 'Saved Addresses', 'Manage your service locations', () async {
              await Navigator.of(context).push(MaterialPageRoute(builder: (_) => const AddressesScreen()));
              _load();
            }),
            _tile(Icons.notifications_none_rounded, 'Notifications', 'Updates about your bookings', () { _soon(); }),
            _tile(Icons.credit_card_rounded, 'Payment Methods', 'Your preferred payment options', () { _soon(); }),
            _tile(Icons.devices_rounded, 'Pair Web Browser', 'Connect your account to the web', _pairBrowser),
            const SizedBox(height: 22),
            const Padding(
              padding: EdgeInsets.only(left: 2, bottom: 11),
              child: Text('SUPPORT & LEGAL', style: TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.15)),
            ),
            _tile(Icons.support_agent_rounded, 'Help & Support', 'We are here if you need help', () async {
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
                      Text('support@kaamdaar.in', style: TextStyle(fontWeight: FontWeight.w700)),
                    ],
                  ),
                  actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close'))],
                ),
              );
            }),
            _tile(Icons.description_outlined, 'Terms & Privacy', 'Read our policies', () { _soon(); }),
            const SizedBox(height: 8),
            _tile(Icons.logout_rounded, 'Logout', _logout, danger: true),
          ],
        ),
      ),
    );
  }

  void _soon() => ScaffoldMessenger.of(context)
      .showSnackBar(const SnackBar(content: Text('Coming soon')));

  Widget _stat(String label, String value, IconData icon, Color accent) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 5),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(19),
          border: Border.all(color: const Color(0xFFE7ECF2)),
          boxShadow: [BoxShadow(color: KColors.navy.withOpacity(.045), blurRadius: 14, offset: const Offset(0, 5))],
        ),
        child: Column(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: accent.withOpacity(.12), borderRadius: BorderRadius.circular(12)),
              child: Icon(icon, size: 19, color: accent),
            ),
            const SizedBox(height: 9),
            Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 19, color: KColors.navy)),
            const SizedBox(height: 2),
            Text(label, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 10.5, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }

  Widget _tile(IconData icon, String label, String subtitle, VoidCallback onTap,
      {bool danger = false}) {
    final color = danger ? KColors.red : KColors.navy;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFE7ECF2)),
              boxShadow: [BoxShadow(color: KColors.navy.withOpacity(.035), blurRadius: 12, offset: const Offset(0, 4))],
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: danger ? KColors.red.withOpacity(.08) : KColors.flame.withOpacity(.10),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: color, size: 21),
                ),
                const SizedBox(width: 13),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: danger ? KColors.red : const Color(0xFF172033))),
                      const SizedBox(height: 3),
                      Text(subtitle, style: const TextStyle(fontSize: 11.5, color: Color(0xFF7B8797)), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: Colors.blueGrey.shade300, size: 23),
              ],
            ),
          ),
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


/// Supports both uploaded data URLs (web FileReader) and hosted image URLs.
ImageProvider<Object>? _profileImage(String value) {
  if (value.isEmpty) return null;
  try {
    if (value.startsWith('data:image/')) {
      final comma = value.indexOf(',');
      if (comma < 0) return null;
      return MemoryImage(base64Decode(value.substring(comma + 1)));
    }
    if (value.startsWith('https://') || value.startsWith('http://')) {
      return NetworkImage(value);
    }
  } catch (_) {
    return null;
  }
  return null;
}
