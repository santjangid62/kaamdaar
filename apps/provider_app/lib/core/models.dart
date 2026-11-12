/// Data models mirroring the Next.js backend (src/lib/types.ts).
library;

class SessionUser {
  final String id;
  final String phone;
  final String firstName;
  final String lastName;
  final String email;
  final String referralCode;

  SessionUser({
    required this.id,
    required this.phone,
    this.firstName = "",
    this.lastName = "",
    this.email = "",
    this.referralCode = "",
  });

  String get name {
    final full = "$firstName $lastName".trim();
    return full.isEmpty ? phone : full;
  }

  factory SessionUser.fromJson(Map<String, dynamic> j) => SessionUser(
        id: (j["id"] ?? j["phone"] ?? "").toString(),
        phone: (j["phone"] ?? "").toString(),
        firstName: (j["firstName"] ?? "").toString(),
        lastName: (j["lastName"] ?? "").toString(),
        email: (j["email"] ?? "").toString(),
        referralCode: (j["referralCode"] ?? "").toString(),
      );

  Map<String, dynamic> toJson() => {
        "id": id,
        "phone": phone,
        "firstName": firstName,
        "lastName": lastName,
        "email": email,
        "referralCode": referralCode,
      };
}

class ServiceItem {
  final String id;
  final String name;
  final String category;
  final String tagline;
  final String description;
  final List<String> includes;
  final List<String> excludes;
  final String duration;
  final int price;
  final String unit;
  final bool popular;
  final String icon;
  final String image;

  factory ServiceItem.fromJson(Map<String, dynamic> j) => ServiceItem(
        id: (j["id"] ?? "").toString(),
        name: (j["name"] ?? "").toString(),
        category: (j["category"] ?? "").toString(),
        tagline: (j["tagline"] ?? "").toString(),
        description: (j["description"] ?? "").toString(),
        includes: _strList(j["includes"]),
        excludes: _strList(j["excludes"]),
        duration: (j["duration"] ?? "").toString(),
        price: _int(j["price"]),
        unit: (j["unit"] ?? "per task").toString(),
        popular: j["popular"] == true,
        icon: (j["icon"] ?? "").toString(),
        image: (j["image"] ?? "").toString(),
      );

  const ServiceItem({
    required this.id,
    required this.name,
    required this.category,
    this.tagline = "",
    this.description = "",
    this.includes = const [],
    this.excludes = const [],
    this.duration = "",
    this.price = 0,
    this.unit = "per task",
    this.popular = false,
    this.icon = "",
    this.image = "",
  });
}

class ProviderItem {
  final String id;
  final String name;
  final String phone;
  final String kycStatus;
  final List<String> services;
  final double lat;
  final double lng;
  final String city;
  final double rating;
  final int jobs;
  final int experience;
  final bool verified;
  final bool policeVerified;
  final int hourlyRate;
  final int reviewCount;
  final double distanceKm;

  factory ProviderItem.fromJson(Map<String, dynamic> j, {double distance = 0}) =>
      ProviderItem(
        id: (j["id"] ?? "").toString(),
        name: (j["name"] ?? "").toString(),
        phone: (j["phone"] ?? "").toString(),
        kycStatus: (j["kycStatus"] ?? "Pending").toString(),
        services: _strList(j["services"]),
        lat: _num(j["lat"]).toDouble(),
        lng: _num(j["lng"]).toDouble(),
        city: (j["city"] ?? "").toString(),
        rating: _num(j["rating"]).toDouble(),
        jobs: _int(j["jobs"]),
        experience: _int(j["experience"]),
        verified: j["verified"] == true,
        policeVerified: j["policeVerified"] == true,
        hourlyRate: _int(j["hourlyRate"]),
        reviewCount: _int(j["reviewCount"]),
        distanceKm: distance,
      );

  const ProviderItem({
    required this.id,
    required this.name,
    this.phone = "",
    this.kycStatus = "Pending",
    this.services = const [],
    this.lat = 0,
    this.lng = 0,
    this.city = "",
    this.rating = 0,
    this.jobs = 0,
    this.experience = 0,
    this.verified = false,
    this.policeVerified = false,
    this.hourlyRate = 0,
    this.reviewCount = 0,
    this.distanceKm = 0,
  });
}

class AddressItem {
  final String id;
  final String label;
  final String line1;
  final String line2;
  final String city;
  final String pincode;
  final double? lat;
  final double? lng;
  final bool isDefault;

  factory AddressItem.fromJson(Map<String, dynamic> j) => AddressItem(
        id: (j["id"] ?? "").toString(),
        label: (j["label"] ?? "Address").toString(),
        line1: (j["line1"] ?? "").toString(),
        line2: (j["line2"] ?? "").toString(),
        city: (j["city"] ?? "").toString(),
        pincode: (j["pincode"] ?? "").toString(),
        lat: j["lat"] == null ? null : _num(j["lat"]).toDouble(),
        lng: j["lng"] == null ? null : _num(j["lng"]).toDouble(),
        isDefault: j["isDefault"] == true,
      );

  AddressItem({
    required this.id,
    required this.label,
    required this.line1,
    this.line2 = "",
    required this.city,
    required this.pincode,
    this.lat,
    this.lng,
    this.isDefault = false,
  });

  Map<String, dynamic> toJson() => {
        "id": id,
        "label": label,
        "line1": line1,
        if (line2.isNotEmpty) "line2": line2,
        "city": city,
        "pincode": pincode,
        if (lat != null) "lat": lat,
        if (lng != null) "lng": lng,
        "isDefault": isDefault,
      };

  String get oneLine => [line1, if (line2.isNotEmpty) line2, city, pincode]
      .where((s) => s.isNotEmpty)
      .join(", ");
}

class ReviewItem {
  final String author;
  final double rating;
  final String text;

  factory ReviewItem.fromJson(Map<String, dynamic> j) => ReviewItem(
        author: (j["author"] ?? "").toString(),
        rating: _num(j["rating"]).toDouble(),
        text: (j["text"] ?? "").toString(),
      );

  const ReviewItem({required this.author, required this.rating, required this.text});
}

class ProviderProfile {
  final String id;
  final String name;
  final double rating;
  final int jobs;
  final int experience;
  final bool verified;
  final bool policeVerified;
  final int hourlyRate;
  final int reviewCount;
  final List<ReviewItem> reviews;
  final double distanceKm;

  factory ProviderProfile.fromJson(Map<String, dynamic> j) => ProviderProfile(
        id: (j["id"] ?? "").toString(),
        name: (j["name"] ?? "").toString(),
        rating: _num(j["rating"]).toDouble(),
        jobs: _int(j["jobs"]),
        experience: _int(j["experience"]),
        verified: j["verified"] == true,
        policeVerified: j["policeVerified"] == true,
        hourlyRate: _int(j["hourlyRate"]),
        reviewCount: _int(j["reviewCount"]),
        reviews: (j["reviews"] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(ReviewItem.fromJson)
            .toList(),
        distanceKm: _num(j["distanceKm"]).toDouble(),
      );

  const ProviderProfile({
    required this.id,
    required this.name,
    this.rating = 0,
    this.jobs = 0,
    this.experience = 0,
    this.verified = false,
    this.policeVerified = false,
    this.hourlyRate = 0,
    this.reviewCount = 0,
    this.reviews = const [],
    this.distanceKm = 0,
  });
}

class BookingItem {
  final String id;
  final String userId;
  final String phone;
  final String serviceId;
  final String serviceName;
  final String providerId;
  final String providerName;
  final AddressItem address;
  final String mode;
  final String date;
  final String slot;
  final int amount;
  final String status;
  final int createdAt;
  final int? offerExpiresAt;
  final List<String> notifiedIds;
  final int? acceptedAt;
  final int? enrouteAt;
  final int? arrivedAt;
  final int? startedAt;
  final int? completedAt;
  final int? paidAt;
  final String? paymentMethod;
  final int commission;
  final int etaMinutes;
  final ProviderProfile? providerProfile;
  final String? startOtp;
  final String? completeOtp;
  final String notes;
  final double? customerLat;
  final double? customerLng;

  factory BookingItem.fromJson(Map<String, dynamic> j) {
    final origin = j["originPoint"] as Map<String, dynamic>?;
    final address = (j["address"] as Map<String, dynamic>?) ?? const {};
    return BookingItem(
        id: (j["id"] ?? "").toString(),
        userId: (j["userId"] ?? "").toString(),
        phone: (j["phone"] ?? "").toString(),
        serviceId: (j["serviceId"] ?? "").toString(),
        serviceName: (j["serviceName"] ?? "").toString(),
        providerId: (j["providerId"] ?? "").toString(),
        providerName: (j["providerName"] ?? "").toString(),
        address: AddressItem.fromJson(
            (j["address"] as Map<String, dynamic>?) ?? const {}),
        mode: (j["mode"] ?? "instant").toString(),
        date: (j["date"] ?? "").toString(),
        slot: (j["slot"] ?? "").toString(),
        amount: _int(j["amount"]),
        status: (j["status"] ?? "dispatched").toString(),
        createdAt: _int(j["createdAt"]),
        offerExpiresAt: _optInt(j["offerExpiresAt"]),
        notifiedIds: _strList(j["notifiedIds"]),
        acceptedAt: _optInt(j["acceptedAt"]),
        enrouteAt: _optInt(j["enrouteAt"]),
        arrivedAt: _optInt(j["arrivedAt"]),
        startedAt: _optInt(j["startedAt"]),
        completedAt: _optInt(j["completedAt"]),
        paidAt: _optInt(j["paidAt"]),
        paymentMethod: j["paymentMethod"]?.toString(),
        commission: _int(j["commission"]),
        etaMinutes: _int(j["etaMinutes"]),
        providerProfile: j["providerProfile"] is Map<String, dynamic>
            ? ProviderProfile.fromJson(j["providerProfile"] as Map<String, dynamic>)
            : null,
        startOtp: j["startOtp"]?.toString(),
        completeOtp: j["completeOtp"]?.toString(),
        notes: (j["notes"] ?? "").toString(),
        customerLat: origin?["lat"] == null
            ? (address["lat"] == null ? null : _num(address["lat"]).toDouble())
            : _num(origin?["lat"]).toDouble(),
        customerLng: origin?["lng"] == null
            ? (address["lng"] == null ? null : _num(address["lng"]).toDouble())
            : _num(origin?["lng"]).toDouble(),
      );
  }

  const BookingItem({
    required this.id,
    required this.userId,
    required this.phone,
    required this.serviceId,
    required this.serviceName,
    this.providerId = "",
    this.providerName = "",
    required this.address,
    this.mode = "instant",
    this.date = "",
    this.slot = "",
    this.amount = 0,
    this.status = "dispatched",
    this.createdAt = 0,
    this.offerExpiresAt,
    this.notifiedIds = const [],
    this.acceptedAt,
    this.enrouteAt,
    this.arrivedAt,
    this.startedAt,
    this.completedAt,
    this.paidAt,
    this.paymentMethod,
    this.commission = 0,
    this.etaMinutes = 0,
    this.providerProfile,
    this.startOtp,
    this.completeOtp,
    this.notes = "",
    this.customerLat,
    this.customerLng,
  });

  bool get isLive =>
      status == "dispatched" ||
      status == "accepted" ||
      status == "scheduled" ||
      status == "enroute" ||
      status == "arrived" ||
      status == "in_progress" ||
      status == "pending_confirm";
}

class WalletTxn {
  final String kind;
  final int amount;
  final String note;
  final int balanceAfter;
  final int createdAt;

  factory WalletTxn.fromJson(Map<String, dynamic> j) => WalletTxn(
        kind: (j["kind"] ?? "").toString(),
        amount: _int(j["amount"]),
        note: (j["note"] ?? "").toString(),
        balanceAfter: _int(j["balanceAfter"]),
        createdAt: _int(j["createdAt"]),
      );

  const WalletTxn({
    required this.kind,
    required this.amount,
    required this.note,
    required this.balanceAfter,
    required this.createdAt,
  });
}

class WalletInfo {
  final String providerId;
  final int balance;

  factory WalletInfo.fromJson(Map<String, dynamic> j) => WalletInfo(
        providerId: (j["providerId"] ?? "").toString(),
        balance: _int(j["balance"]),
      );

  const WalletInfo({required this.providerId, required this.balance});
}

num _num(dynamic v) => v is num ? v : num.tryParse("$v") ?? 0;
int _int(dynamic v) => v is int ? v : (v is num ? v.round() : int.tryParse("$v") ?? 0);
int? _optInt(dynamic v) => v == null ? null : _int(v);
List<String> _strList(dynamic v) =>
    (v as List? ?? []).map((e) => "$e").toList();