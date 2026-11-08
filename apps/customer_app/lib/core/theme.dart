/// Kaamdaar brand theme — navy + flame orange, matching the web app.
library;
import 'package:flutter/material.dart';

class KColors {
  static const navy = Color(0xFF0B2240);
  static const flame = Color(0xFFFF7A00);
  static const flameDark = Color(0xFFF08A24);
  static const amber = Color(0xFFFBBF24);
  static const offwhite = Color(0xFFF4F6F9);
  static const green = Color(0xFF16A34A);
  static const red = Color(0xFFDC2626);
  static const blue = Color(0xFF2563EB);
}

ThemeData kamTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: KColors.flame,
      primary: KColors.flame,
      secondary: KColors.navy,
      surface: Colors.white,
    ),
    scaffoldBackgroundColor: KColors.offwhite,
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: KColors.navy,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        color: KColors.navy,
        fontSize: 18,
        fontWeight: FontWeight.w800,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: KColors.flame, width: 1.6),
      ),
    ),
  );
}

/// Full-width brand CTA.
class PrimaryBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;

  const PrimaryBtn({
    super.key,
    required this.label,
    this.onPressed,
    this.busy = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 54,
      child: ElevatedButton(
        onPressed: busy ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: KColors.flame,
          foregroundColor: KColors.navy,
          disabledBackgroundColor: KColors.flame.withOpacity(.5),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
        ),
        child: busy
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: KColors.navy),
              )
            : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
                Text(label),
              ]),
      ),
    );
  }
}

/// Outlined secondary button.
class GhostBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final Color color;

  const GhostBtn({super.key, required this.label, this.onPressed, this.color = KColors.navy});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: color.withOpacity(.4)),
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
      child: Text(label),
    );
  }
}

/// Dispatch status → label + colour (same vocabulary as the web app).
const kStatusLabels = <String, String>{
  'dispatched': 'Finding your Pro…',
  'accepted': 'Pro assigned',
  'scheduled': 'Scheduled',
  'enroute': 'On the way',
  'arrived': 'Arrived',
  'in_progress': 'Service started',
  'pending_confirm': 'Awaiting your confirmation',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
};

Color kStatusColor(String status) {
  switch (status) {
    case 'dispatched':
      return KColors.blue;
    case 'accepted':
    case 'scheduled':
      return KColors.flame;
    case 'enroute':
    case 'arrived':
      return const Color(0xFF7C3AED);
    case 'in_progress':
      return KColors.navy;
    case 'pending_confirm':
      return const Color(0xFF0891B2);
    case 'completed':
      return KColors.green;
    default:
      return KColors.red;
  }
}

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final c = kStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.withOpacity(.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        kStatusLabels[status] ?? status,
        style: TextStyle(color: c, fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class CardBox extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  const CardBox({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
    if (onTap == null) return card;
    return InkWell(onTap: onTap, borderRadius: BorderRadius.circular(16), child: card);
  }
}

String rupees(num v) => '₹${v.toStringAsFixed(0)}';