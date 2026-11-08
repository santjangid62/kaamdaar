import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:kaamdaar_customer/core/theme.dart';
import 'package:kaamdaar_customer/core/api.dart';
import 'package:kaamdaar_customer/main.dart';
import 'package:kaamdaar_customer/screens/profile.dart';

void main() {
  testWidgets('app boots to the splash screen', (tester) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});
    await tester.pumpWidget(const KaamdaarApp());
    expect(find.text('Kaamdaar'), findsOneWidget);
    await tester.pump(const Duration(seconds: 2));
  });

  test('Indian PIN validation rejects invalid codes', () {
    expect(validatePincode('302017'), isNull);
    expect(validatePincode('012345'), isNotNull);
    expect(validatePincode('30201'), isNotNull);
    expect(validatePincode('abcdef'), isNotNull);
    expect(validatePincode(''), isNotNull);
  });

  test('Indian mobile validation accepts valid 10-digit numbers', () {
    expect(Api.isValidIndianMobile('9876543210'), isTrue);
    expect(Api.isValidIndianMobile('+91 98765 43210'), isTrue);
    expect(Api.isValidIndianMobile('1234567890'), isFalse);
    expect(Api.isValidIndianMobile('987654321'), isFalse);
  });

  test('currency helper formats rupees', () {
    expect(rupees(299), '₹299');
  });
}
