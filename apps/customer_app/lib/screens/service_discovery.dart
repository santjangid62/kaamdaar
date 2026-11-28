import 'package:flutter/material.dart';

import '../core/models.dart';
import '../core/theme.dart';
import 'home.dart' show iconFor;

/// Fast, category-led discovery with Kaamdaar's own brand identity.
class BlinkitStyleServiceCatalog extends StatefulWidget {
  final List<ServiceItem> services;
  final List<String> categories;
  final Map<String, int> providerCounts;
  final ValueChanged<ServiceItem> onServiceTap;

  const BlinkitStyleServiceCatalog({
    super.key, required this.services, required this.categories,
    required this.providerCounts, required this.onServiceTap,
  });

  @override
  State<BlinkitStyleServiceCatalog> createState() => _BlinkitStyleServiceCatalogState();
}

class _BlinkitStyleServiceCatalogState extends State<BlinkitStyleServiceCatalog> {
  String? _selectedCategory;

  List<ServiceItem> _children(String parentId) =>
      widget.services.where((s) => s.parent == parentId).toList()
        ..sort((a, b) => a.name.compareTo(b.name));

  List<ServiceItem> _leaves(ServiceItem root) {
    final children = _children(root.id);
    if (children.isEmpty) return [root];
    return children.expand(_leaves).toList();
  }

  @override
  Widget build(BuildContext context) {
    final categories = widget.categories;
    final selectedCategory = categories.contains(_selectedCategory) ? _selectedCategory : null;
    final roots = widget.services.where((s) => s.parent.isEmpty).toList();
    final visibleCategories = selectedCategory == null ? categories : [selectedCategory];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SizedBox(
        height: 46,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: categories.length,
          separatorBuilder: (_, __) => const SizedBox(width: 8),
          itemBuilder: (context, index) {
            final category = categories[index];
            final active = category == selectedCategory;
            return InkWell(
              borderRadius: BorderRadius.circular(13),
              onTap: () => setState(() => _selectedCategory = active ? null : category),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 15),
                decoration: BoxDecoration(
                  color: active ? KColors.navy : Colors.white,
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(color: active ? KColors.navy : const Color(0xFFE8ECF2)),
                ),
                child: Text(category, style: TextStyle(
                  color: active ? Colors.white : KColors.navy,
                  fontSize: 12, fontWeight: FontWeight.w800,
                )),
              ),
            );
          },
        ),
      ),
      const SizedBox(height: 18),
      ...visibleCategories.map((category) {
        final categoryRoots = roots.where((root) => root.category.trim() == category).toList();
        final bundles = categoryRoots.expand((root) {
          final children = _children(root.id);
          return children.isEmpty ? [root] : children;
        }).toList();
        if (bundles.isEmpty) return const SizedBox.shrink();
        return Padding(
          padding: const EdgeInsets.only(bottom: 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text(category, style: const TextStyle(
                color: KColors.navy, fontSize: 17, fontWeight: FontWeight.w900,
              ))),
              if (selectedCategory != null)
                TextButton(onPressed: () => setState(() => _selectedCategory = null), child: const Text('View all')),
              if (selectedCategory == null)
                Text('${bundles.length} collections', style: const TextStyle(color: Colors.black45, fontSize: 11)),
            ]),
            const SizedBox(height: 10),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: bundles.length,
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 3, mainAxisSpacing: 9, crossAxisSpacing: 9,
                childAspectRatio: .91,
              ),
              itemBuilder: (context, index) {
                final bundle = bundles[index];
                final leaves = _leaves(bundle);
                final count = leaves.fold<int>(0, (sum, item) => sum + (widget.providerCounts[item.id] ?? 0));
                return InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => _CategoryBrowseScreen(
                      title: bundle.name, services: widget.services, bundle: bundle,
                      providerCounts: widget.providerCounts, onServiceTap: widget.onServiceTap,
                    ),
                  )),
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(7, 10, 7, 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8F9FB), borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE9EDF2)),
                    ),
                    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Expanded(child: Icon(iconFor(bundle.icon.isEmpty ? bundle.name : bundle.icon),
                        size: 35, color: KColors.flame)),
                      const SizedBox(height: 4),
                      Text(bundle.name, maxLines: 2, textAlign: TextAlign.center,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: KColors.navy)),
                      const SizedBox(height: 4),
                      Text('${leaves.length} services • $count online', maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontSize: 8.5, color: Colors.black54)),
                    ]),
                  ),
                );
              },
            ),
          ]),
        );
      }),
    ]);
  }
}

class _CategoryBrowseScreen extends StatefulWidget {
  final String title;
  final List<ServiceItem> services;
  final ServiceItem bundle;
  final Map<String, int> providerCounts;
  final ValueChanged<ServiceItem> onServiceTap;

  const _CategoryBrowseScreen({
    required this.title, required this.services, required this.bundle,
    required this.providerCounts, required this.onServiceTap,
  });

  @override
  State<_CategoryBrowseScreen> createState() => _CategoryBrowseScreenState();
}

class _CategoryBrowseScreenState extends State<_CategoryBrowseScreen> {
  String? _selectedId;

  List<ServiceItem> _children(String id) =>
      widget.services.where((service) => service.parent == id).toList()
        ..sort((a, b) => a.name.compareTo(b.name));

  @override
  Widget build(BuildContext context) {
    final direct = _children(widget.bundle.id);
    final groups = direct.where((item) => _children(item.id).isNotEmpty).toList();
    final leftItems = groups.isNotEmpty ? groups : (direct.isNotEmpty ? direct : [widget.bundle]);
    ServiceItem selected = leftItems.first;
    for (final item in leftItems) {
      if (item.id == _selectedId) { selected = item; break; }
    }
    final children = _children(selected.id);
    final shownServices = children.isEmpty ? [selected] : children;
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      appBar: AppBar(
        backgroundColor: Colors.white, elevation: 0,
        leading: IconButton(
          tooltip: 'Close', onPressed: () => Navigator.of(context).pop(),
          icon: const Icon(Icons.close_rounded, color: KColors.navy),
        ),
        title: Text(widget.title, style: const TextStyle(color: KColors.navy, fontWeight: FontWeight.w900)),
      ),
      body: Row(children: [
        SizedBox(
          width: 116,
          child: ListView.builder(
            itemCount: leftItems.length,
            itemBuilder: (context, index) {
              final item = leftItems[index];
              final active = selected.id == item.id;
              return InkWell(
                onTap: () => setState(() => _selectedId = item.id),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  padding: const EdgeInsets.fromLTRB(8, 16, 8, 16),
                  decoration: BoxDecoration(
                    color: active ? Colors.white : const Color(0xFFF1F3F6),
                    border: Border(left: BorderSide(color: active ? KColors.flame : Colors.transparent, width: 4)),
                  ),
                  child: Column(children: [
                    Icon(iconFor(item.icon.isEmpty ? item.name : item.icon),
                      color: active ? KColors.flame : Colors.black54, size: 24),
                    const SizedBox(height: 7),
                    Text(item.name, textAlign: TextAlign.center, maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 10, fontWeight: active ? FontWeight.w900 : FontWeight.w600,
                        color: active ? KColors.navy : Colors.black54)),
                  ]),
                ),
              );
            },
          ),
        ),
        Expanded(
          child: Container(
            color: Colors.white,
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: shownServices.length,
              separatorBuilder: (_, __) => const Divider(height: 18),
              itemBuilder: (context, index) {
                final service = shownServices[index];
                return InkWell(
                  onTap: () => widget.onServiceTap(service),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Container(width: 54, height: 54,
                        decoration: BoxDecoration(color: KColors.flame.withOpacity(.09), borderRadius: BorderRadius.circular(13)),
                        child: Icon(iconFor(service.icon.isEmpty ? service.category : service.icon), color: KColors.flame, size: 27)),
                      const SizedBox(width: 9),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(service.name, maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: KColors.navy)),
                        const SizedBox(height: 4),
                        Text(service.price == 0 ? 'Price on request' : 'Starting ₹${service.price}',
                          style: const TextStyle(fontSize: 10, color: Colors.black54)),
                      ])),
                      const Icon(Icons.chevron_right, color: Colors.black38),
                    ]),
                    const SizedBox(height: 7),
                    ProviderCountLabel(count: widget.providerCounts[service.id]),
                  ]),
                );
              },
            ),
          ),
        ),
      ]),
    );
  }
}

class ProviderCountLabel extends StatelessWidget {
  final int? count;
  const ProviderCountLabel({super.key, required this.count});

  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
    Icon(Icons.circle, size: 7, color: count == null ? Colors.black26 : (count! > 0 ? const Color(0xFF159B62) : Colors.redAccent)),
    const SizedBox(width: 5),
    Text(count == null ? 'Availability checking' : '$count providers online',
      style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800,
        color: count == null ? Colors.black45 : (count! > 0 ? const Color(0xFF159B62) : Colors.redAccent))),
  ]);
}
