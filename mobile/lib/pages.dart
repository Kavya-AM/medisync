import 'dart:async';
import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'main.dart';
import 'more.dart';

/// Push notifications. If Firebase is not set up (see docs/FIREBASE.md) this quietly does nothing
/// and the in-app reminder pop-up still works.
Future<void> initPush(BuildContext context) async {
  try {
    await Firebase.initializeApp();
    final m = FirebaseMessaging.instance;
    await m.requestPermission();
    final t = await m.getToken();
    if (t != null) {
      await http.post(Uri.parse('$base/devices'), headers: await headers(), body: jsonEncode({'token': t}));
    }
    FirebaseMessaging.onMessage.listen((msg) {
      final n = msg.notification;
      if (n != null && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${n.title}: ${n.body}')));
      }
    });
  } catch (_) {}
}

class Shell extends StatefulWidget {
  const Shell({super.key});
  @override
  State<Shell> createState() => _ShellState();
}

class _ShellState extends State<Shell> {
  int i = 0, n = 0;
  List rem = [];
  Timer? tick;
  final fired = <String>{};

  @override
  void initState() {
    super.initState();
    pull();
    WidgetsBinding.instance.addPostFrameCallback((_) => initPush(context));
    // Checks every 10 seconds while the app is open, on any screen.
    tick = Timer.periodic(const Duration(seconds: 10), (_) {
      if (++n % 6 == 0) pull();
      check();
    });
  }

  @override
  void dispose() {
    tick?.cancel();
    super.dispose();
  }

  Future<void> pull() async {
    try {
      final r = await http.get(Uri.parse('$base/reminders'), headers: await headers());
      if (r.statusCode == 200) rem = jsonDecode(r.body);
    } catch (_) {}
  }

  void check() {
    if (!mounted) return;
    final d = DateTime.now();
    final now = d.hour * 60 + d.minute;
    for (final r in rem) {
      if (r['active'] != true) continue;
      final p = (r['time'] as String).split(':');
      final t = int.parse(p[0]) * 60 + int.parse(p[1]);
      // Fires once per day, up to 5 minutes after the set time.
      if (now >= t && now - t <= 5 && fired.add('${r['_id']}${d.day}')) {
        SystemSound.play(SystemSoundType.alert);
        HapticFeedback.heavyImpact();
        showDialog(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Medicine time'),
            content: Text('Take ${r['medicine']} (${r['time']}).'),
            actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Taken'))],
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext c) => Scaffold(
        body: [const Home(), const VisitsPage(), const VitalsPage(), RemindersPage(onChanged: pull), const MorePage()][i],
        bottomNavigationBar: NavigationBar(
          selectedIndex: i,
          onDestinationSelected: (v) => setState(() => i = v),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.medical_services), label: 'Doctors'),
            NavigationDestination(icon: Icon(Icons.event), label: 'Visits'),
            NavigationDestination(icon: Icon(Icons.monitor_heart), label: 'Readings'),
            NavigationDestination(icon: Icon(Icons.alarm), label: 'Reminders'),
            NavigationDestination(icon: Icon(Icons.more_horiz), label: 'More'),
          ],
        ),
      );
}

class VisitsPage extends StatefulWidget {
  const VisitsPage({super.key});
  @override
  State<VisitsPage> createState() => _VisitsPageState();
}

class _VisitsPageState extends State<VisitsPage> {
  List items = [];
  bool loaded = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  void snack(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> load() async {
    final r = await http.get(Uri.parse('$base/appointments/mine'), headers: await headers());
    if (!mounted) return;
    setState(() {
      items = r.statusCode == 200 ? jsonDecode(r.body) : [];
      loaded = true;
    });
  }

  Future<void> cancel(Map a) async {
    await http.patch(Uri.parse('$base/appointments/${a['_id']}/cancel'), headers: await headers());
    load();
  }

  Future<void> join(Map a) async {
    final r = await http.get(Uri.parse('$base/appointments/${a['_id']}/video'), headers: await headers());
    if (!mounted) return;
    if (r.statusCode != 200) return snack(jsonDecode(r.body)['error'] ?? 'Could not start the call');
    await launchUrl(Uri.parse(jsonDecode(r.body)['url']), mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext c) => Scaffold(
        appBar: AppBar(title: const Text('My visits')),
        body: !loaded
            ? const Center(child: CircularProgressIndicator())
            : items.isEmpty
                ? const Center(child: Text('No visits yet. Book one from Doctors.'))
                : RefreshIndicator(
                    onRefresh: load,
                    child: ListView(children: [
                      for (final a in items)
                        Card(
                          child: ListTile(
                            title: Text(a['doctor']?['name'] ?? 'Doctor'),
                            subtitle: Text('${a['date']} · ${a['time']} · ${a['status']}${a['paid'] == true ? ' · paid' : ''}'),
                            trailing: a['status'] == 'cancelled'
                                ? null
                                : Row(mainAxisSize: MainAxisSize.min, children: [
                                    IconButton(tooltip: 'Join video call', icon: const Icon(Icons.videocam), onPressed: () => join(a)),
                                    if (a['status'] == 'booked')
                                      IconButton(tooltip: 'Cancel visit', icon: const Icon(Icons.cancel_outlined), onPressed: () => cancel(a)),
                                  ]),
                          ),
                        ),
                    ]),
                  ),
      );
}

class SymptomPage extends StatefulWidget {
  const SymptomPage({super.key});
  @override
  State<SymptomPage> createState() => _SymptomPageState();
}

class _SymptomPageState extends State<SymptomPage> {
  final text = TextEditingController();
  Map? result;

  Future<void> check() async {
    final r = await http.post(Uri.parse('$base/symptoms'), headers: await headers(), body: jsonEncode({'text': text.text}));
    if (!mounted) return;
    setState(() => result = jsonDecode(r.body));
  }

  @override
  Widget build(BuildContext c) {
    final res = result;
    return Scaffold(
      appBar: AppBar(title: const Text('Symptom checker')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextField(controller: text, maxLines: 3, decoration: const InputDecoration(hintText: 'Example: fever and sore throat', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          FilledButton(onPressed: check, child: const Text('Suggest a specialist')),
          if (res != null)
            Card(
              color: res['urgent'] == true ? Colors.red.shade50 : null,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: res['error'] != null
                    ? Text(res['error'])
                    : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(res['urgent'] == true ? res['specialty'] : 'See a ${res['specialty']}', style: Theme.of(c).textTheme.titleMedium),
                        const SizedBox(height: 6),
                        Text(res['advice']),
                        const SizedBox(height: 6),
                        Text(res['source'] == 'ai' ? 'AI suggestion' : 'Basic keyword check', style: Theme.of(c).textTheme.bodySmall),
                      ]),
              ),
            ),
        ]),
      ),
    );
  }
}

class RemindersPage extends StatefulWidget {
  final VoidCallback? onChanged;
  const RemindersPage({super.key, this.onChanged});
  @override
  State<RemindersPage> createState() => _RemindersPageState();
}

class _RemindersPageState extends State<RemindersPage> {
  List items = [];

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final r = await http.get(Uri.parse('$base/reminders'), headers: await headers());
    if (!mounted) return;
    setState(() => items = jsonDecode(r.body));
    widget.onChanged?.call();
  }

  Future<void> add() async {
    final name = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('New reminder'),
        content: TextField(controller: name, decoration: const InputDecoration(labelText: 'Medicine name')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Next')),
        ],
      ),
    );
    if (ok != true || name.text.trim().isEmpty || !mounted) return;
    final t = await showTimePicker(context: context, initialTime: const TimeOfDay(hour: 8, minute: 0));
    if (t == null) return;
    await http.post(Uri.parse('$base/reminders'),
        headers: await headers(),
        body: jsonEncode({
          'medicine': name.text.trim(),
          'time': '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}'
        }));
    load();
  }

  Future<void> toggle(Map r, bool v) async {
    await http.patch(Uri.parse('$base/reminders/${r['_id']}'), headers: await headers(), body: jsonEncode({'active': v}));
    load();
  }

  @override
  Widget build(BuildContext c) => Scaffold(
        appBar: AppBar(title: const Text('Medicine reminders')),
        floatingActionButton: FloatingActionButton(onPressed: add, child: const Icon(Icons.add)),
        body: items.isEmpty
            ? const Center(child: Text('No reminders yet. Tap + to add one.'))
            : ListView(children: [
                for (final r in items)
                  SwitchListTile(
                    title: Text(r['medicine']),
                    subtitle: Text('Daily at ${r['time']}'),
                    value: r['active'] == true,
                    onChanged: (v) => toggle(r, v),
                  ),
              ]),
      );
}
