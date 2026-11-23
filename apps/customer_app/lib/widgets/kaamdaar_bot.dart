import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/theme.dart';
import 'kaamdaar_mobile_booking_flow.dart';

class KaamdaarBotLauncher extends StatefulWidget {
  const KaamdaarBotLauncher({super.key});
  @override
  State<KaamdaarBotLauncher> createState() => _KaamdaarBotLauncherState();
}

class _KaamdaarBotLauncherState extends State<KaamdaarBotLauncher> {
  Offset? _position;
  bool _opened = false;

  @override
  Widget build(BuildContext context) {
    return Positioned(
      right: _position == null ? 16 : null,
      bottom: _position == null ? 18 : null,
      left: _position?.dx,
      top: _position?.dy,
      child: GestureDetector(
        onPanUpdate: (details) {
          final size = MediaQuery.sizeOf(context);
          setState(() {
            _position = Offset(
              ((_position?.dx ?? size.width - 76) + details.delta.dx).clamp(8, size.width - 68),
              ((_position?.dy ?? size.height - 150) + details.delta.dy).clamp(60, size.height - 140),
            );
          });
        },
        child: Material(
          color: KColors.flame,
          elevation: 8,
          shape: const CircleBorder(),
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: () => _showBot(context),
            child: const SizedBox(
              width: 58, height: 58,
              child: Icon(Icons.smart_toy_rounded, color: KColors.navy, size: 31),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _showBot(BuildContext context) async {
    if (_opened) return;
    _opened = true;
    await showModalBottomSheet<void>(
      context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (_) => const _KaamdaarBotSheet(),
    );
    _opened = false;
  }
}

class _KaamdaarBotSheet extends StatefulWidget {
  const _KaamdaarBotSheet();
  @override
  State<_KaamdaarBotSheet> createState() => _KaamdaarBotSheetState();
}

class _KaamdaarBotSheetState extends State<_KaamdaarBotSheet> {
  final _input = TextEditingController();
  final List<Map<String, String>> _messages = [
    {'role': 'assistant', 'text': 'नमस्ते! मैं आपका Kaamdaar Bot साथी हूँ। मैं आपके लिए क्या कर सकता हूँ?'},
  ];
  bool _busy = false;

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty || _busy) return;
    _input.clear();
    setState(() { _messages.add({'role': 'user', 'text': text}); _busy = true; });
    try {
      final data = await Api.post('/api/assistant', {
          'message': text,
          'lang': RegExp(r'[\u0900-\u097F]').hasMatch(text) ? 'hi' : 'en',
          'history': _messages.take(_messages.length - 1).toList().map((m) => {
            'role': m['role'] == 'assistant' ? 'assistant' : 'user',
            'content': m['text'],
          }).toList(),
      }).timeout(const Duration(seconds: 25));
      final reply = (data['reply'] ?? '').toString();
      if (reply.isEmpty) throw Exception('Assistant unavailable');
      if (mounted) setState(() => _messages.add({'role': 'assistant', 'text': reply}));
    } catch (_) {
      if (mounted) setState(() => _messages.add({
        'role': 'assistant',
        'text': 'माफ़ कीजिए, अभी Bot से संपर्क नहीं हो पा रहा है। कृपया थोड़ी देर बाद प्रयास करें।',
      }));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Container(
        height: MediaQuery.sizeOf(context).height * .72,
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: KColors.navy, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            child: const Row(children: [
              CircleAvatar(backgroundColor: KColors.flame, child: Icon(Icons.smart_toy_rounded, color: KColors.navy)),
              SizedBox(width: 10),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Kaamdaar Bot', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                Text('आपका सेवा साथी', style: TextStyle(color: Colors.white70, fontSize: 12)),
              ])),
            ]),
          ),
          Expanded(child: ListView.builder(
            padding: const EdgeInsets.all(14),
            itemCount: _messages.length,
            itemBuilder: (_, i) {
              final item = _messages[i];
              final mine = item['role'] == 'user';
              return Align(
                alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 10),
                  constraints: const BoxConstraints(maxWidth: 290),
                  decoration: BoxDecoration(
                    color: mine ? KColors.blue : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Text(item['text'] ?? '', style: TextStyle(color: mine ? Colors.white : KColors.navy)),
                ),
              );
            },
          )),
          const KaamdaarMobileBookingFlow(),
          if (_busy) const Padding(padding: EdgeInsets.all(6), child: LinearProgressIndicator()),
          Padding(
            padding: EdgeInsets.fromLTRB(12, 8, 12, MediaQuery.viewInsetsOf(context).bottom + 12),
            child: Row(children: [
              Expanded(child: TextField(
                controller: _input,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(),
                decoration: const InputDecoration(hintText: 'अपना सवाल लिखें...', border: OutlineInputBorder()),
              )),
              const SizedBox(width: 8),
              IconButton.filled(
                onPressed: _busy ? null : _send,
                style: IconButton.styleFrom(backgroundColor: KColors.flame, foregroundColor: KColors.navy),
                icon: const Icon(Icons.send_rounded),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  @override
  void dispose() { _input.dispose(); super.dispose(); }
}
