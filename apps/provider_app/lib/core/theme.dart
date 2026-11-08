/// Kaamdaar Provider theme — green brand, matching the web Pro panel.
library;

import 'package:flutter/material.dart';

class PColors {
  static const green = Color(0xFF0E9F6E);
  static const greenDark = Color(0xFF087F5B);
  static const ink = Color(0xFF0B2240);
  static const amber = Color(0xFFFBBF24);
  static const red = Color(0xFFDC2626);
  static const blue = Color(0xFF2563EB);
  static const surface = Color(0xFFF4F7F6);
  static const flame = Color(0xFFFF7A00);
}

ThemeData providerTheme() {
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: PColors.green,
      primary: PColors.green,
      secondary: PColors.ink,
      surface: Colors.white,
    ),
    scaffoldBackgroundColor: PColors.surface,
  );
  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: PColors.ink,
      elevation: 0,
      centerTitle: false,
      titleTextStyle:
          TextStyle(color: PColors.ink, fontSize: 18, fontWeight: FontWeight.w800),
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
        borderSide: const BorderSide(color: PColors.green, width: 1.6),
      ),
    ),
  );
}

class PrimaryBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool busy;
  final IconData? icon;
  final Color color;

  const PrimaryBtn({
    super.key,
    required this.label,
    this.onPressed,
    this.busy = false,
    this.icon,
    this.color = PColors.green,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 52,
      child: ElevatedButton(
        onPressed: busy ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          disabledBackgroundColor: color.withValues(alpha: .45),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: const TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800),
        ),
        child: busy
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
              )
            : Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
                Text(label),
              ]),
      ),
    );
  }
}

class GhostBtn extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final Color color;
  const GhostBtn({
    super.key,
    required this.label,
    this.onPressed,
    this.color = PColors.ink,
  });

  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: color.withValues(alpha: .4)),
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
      child: Text(label),
    );
  }
}

class CardBox extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final Color? borderColor;

  const CardBox({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.onTap,
    this.borderColor,
  });

  @override
  Widget build(BuildContext context) {
    final card = Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: borderColor ?? const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: .04),
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

const jobStatusLabels = <String, String>{
  'dispatched': 'New request',
  'accepted': 'Accepted — go to customer',
  'scheduled': 'Scheduled',
  'enroute': 'On the way',
  'arrived': 'Arrived — start OTP',
  'in_progress': 'Service in progress',
  'pending_confirm': 'Waiting for customer OTP',
  'completed': 'Completed',
  'cancelled': 'Cancelled',
};

Color jobStatusColor(String status) {
  switch (status) {
    case 'dispatched':
      return PColors.flame;
    case 'accepted':
    case 'scheduled':
      return PColors.blue;
    case 'enroute':
    case 'arrived':
      return const Color(0xFF7C3AED);
    case 'in_progress':
      return PColors.ink;
    case 'pending_confirm':
      return const Color(0xFF0891B2);
    case 'completed':
      return PColors.green;
    default:
      return PColors.red;
  }
}

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip({super.key, required this.status});

  @override
  Widget build(BuildContext context) {
    final c = jobStatusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: .12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        jobStatusLabels[status] ?? status,
        style: TextStyle(color: c, fontSize: 11.5, fontWeight: FontWeight.w700),
      ),
    );
  }
}

String rupees(num v) => '₹${v.toStringAsFixed(0)}';

/// 10% platform commission — same split the web uses.
int commissionOf(int amount) => (amount * 0.10).round();

String generateOtp() =>
    (1000 + DateTime.now().microsecondsSinceEpoch % 9000).toString();
