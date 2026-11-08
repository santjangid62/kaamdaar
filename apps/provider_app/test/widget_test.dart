import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kaamdaar_provider/core/theme.dart';
import 'package:kaamdaar_provider/main.dart';
import 'package:kaamdaar_provider/screens/auth.dart';

void main() {
  testWidgets('provider app boots to the splash screen', (tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    await tester.pumpWidget(const KaamdaarProviderApp());
    expect(find.text('Kaamdaar'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
  });

  test('Indian mobile validation', () {
    expect(validateIndianMobile('9876543210'), isNull);
    expect(validateIndianMobile('+91 98765 43210'), isNull);
    expect(validateIndianMobile('1234567890'), isNotNull); // cannot start with 1
    expect(validateIndianMobile('987654321'), isNotNull); // 9 digits
    expect(validateIndianMobile('+91 98765 43210'), isNull);
  });

  test('commission is 10% of the job amount', () {
    expect(commissionOf(499), 50);
    expect(commissionOf(299), 30);
  });
}
