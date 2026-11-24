import 'dart:async';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';
import 'main.dart';
import 'pages.dart';

String stamp(String iso) {
  final d = DateTime.tryParse(iso)?.toLocal();
  if (d == null) return '';
  String two(int n) => n.toString().padLeft(2, '0');
  return '${d.year}-${two(d.month)}-${two(d.day)} ${two(d.hour)}:${two(d.minute)}';
}

String num2(dynamic x) => x is num ? (x == x.roundToDouble() ? x.toInt().toString() : x.toString()) : '$x';

// ---------- notifications ----------

/// Bell icon for app bars. Shows how many notifications are unread and opens the list.
class BellButton extends StatefulWidget {
  const BellButton({super.key});
  @override
  State<BellButton> createState() => _BellButtonState();
}

class _BellButtonState extends State<BellButton> {
  int unread = 0;
  Timer? timer;

  @override
  void initState() {
    super.initState();
    load();
    timer = Timer.periodic(const Duration(seconds: 60), (_) => load());
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final r = await apiGet('/notifications');
      if (mounted && ok(r)) setState(() => unread = ((jsonOf(r) as Map)['unread'] ?? 0) as int);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext c) => IconButton(
        tooltip: 'Notifications, $unread unread',
        icon: Badge(isLabelVisible: unread > 0, label: Text('$unread'), child: const Icon(Icons.notifications_outlined)),
        onPressed: () async {
          await Navigator.push(c, MaterialPageRoute(builder: (_) => const NotificationsPage()));
          load();
        },
      );
}

class NotificationsPage extends StatefulWidget {
  const NotificationsPage({super.key});
  @override
  State<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends State<NotificationsPage> {
  List items = [];
  bool loaded = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final r = await apiGet('/notifications');
    if (!mounted) return;
    setState(() {
      items = ok(r) ? ((jsonOf(r) as Map)['items'] as List) : [];
      loaded = true;
    });
  }

  Future<void> readAll() async {
    await apiSend('PATCH', '/notifications/read-all');
    load();
  }

  Future<void> clear() async {
    await apiSend('DELETE', '/notifications');
    load();
  }

  Future<void> read(Map n) async {
    if (n['read'] == true) return;
    await apiSend('PATCH', '/notifications/${n['_id']}/read');
    load();
  }

  @override
  Widget build(BuildContext c) => Scaffold(
        appBar: AppBar(title: const Text('Notifications'), actions: [
          IconButton(tooltip: 'Mark all read', icon: const Icon(Icons.done_all), onPressed: items.isEmpty ? null : readAll),
          IconButton(tooltip: 'Clear all', icon: const Icon(Icons.delete_sweep_outlined), onPressed: items.isEmpty ? null : clear),
        ]),
        body: !loaded
            ? const Center(child: CircularProgressIndicator())
            : items.isEmpty
                ? const Center(child: Text('Nothing yet.'))
                : RefreshIndicator(
                    onRefresh: load,
                    child: ListView(children: [
                      for (final n in items)
                        ListTile(
                          leading: Icon(n['read'] == true ? Icons.notifications_none : Icons.notifications_active, color: n['read'] == true ? null : Theme.of(c).colorScheme.primary),
                          title: Text(n['title'] ?? '', style: TextStyle(fontWeight: n['read'] == true ? FontWeight.normal : FontWeight.bold)),
                          subtitle: Text('${n['body'] ?? ''}\n${stamp(n['createdAt'] ?? '')}'),
                          isThreeLine: true,
                          onTap: () => read(n),
                        ),
                    ]),
                  ),
      );
}

// ---------- health readings ----------

const vitalTypes = {
  'bp': ['Blood pressure', 'mmHg'],
  'sugar': ['Blood sugar', 'mg/dL'],
  'weight': ['Weight', 'kg'],
  'heart': ['Heart rate', 'bpm'],
  'temp': ['Temperature', '°C'],
  'spo2': ['Oxygen (SpO2)', '%'],
};

String showVital(Map v) {
  final t = vitalTypes[v['type']]!;
  final val = v['type'] == 'bp' ? '${num2(v['value'])}/${num2(v['value2'])}' : num2(v['value']);
  return '$val ${t[1]}';
}

Widget statusText(BuildContext c, String? s) {
  if (s == null) return const SizedBox.shrink();
  final label = {'normal': 'In usual range', 'high': 'Above usual range', 'low': 'Below usual range'}[s] ?? s;
  return Text(label, style: TextStyle(color: s == 'normal' ? Colors.green.shade700 : Colors.red.shade700, fontSize: 12));
}

class LinePainter extends CustomPainter {
  final List<double> a;
  final List<double>? b;
  final Color c1, c2;
  LinePainter(this.a, this.b, this.c1, this.c2);

  @override
  void paint(Canvas canvas, Size size) {
    if (a.length < 2) return;
    final second = b;
    final all = [...a, ...?second];
    var lo = all.reduce((x, y) => x < y ? x : y), hi = all.reduce((x, y) => x > y ? x : y);
    if (hi == lo) {
      hi += 1;
      lo -= 1;
    }
    const pad = 16.0;
    Offset pt(int i, double v) => Offset(pad + i * (size.width - 2 * pad) / (a.length - 1), size.height - pad - (v - lo) / (hi - lo) * (size.height - 2 * pad));
    void line(List<double> v, Color col) {
      final path = Path()..moveTo(pt(0, v[0]).dx, pt(0, v[0]).dy);
      for (var i = 1; i < v.length; i++) {
        final o = pt(i, v[i]);
        path.lineTo(o.dx, o.dy);
      }
      canvas.drawPath(path, Paint()..color = col..style = PaintingStyle.stroke..strokeWidth = 3);
      for (var i = 0; i < v.length; i++) {
        canvas.drawCircle(pt(i, v[i]), 3.5, Paint()..color = col);
      }
    }

    line(a, c1);
    if (second != null) line(second, c2);
  }

  @override
  bool shouldRepaint(LinePainter old) => true;
}

class VitalsPage extends StatefulWidget {
  const VitalsPage({super.key});
  @override
  State<VitalsPage> createState() => _VitalsPageState();
}

class _VitalsPageState extends State<VitalsPage> {
  String type = 'bp';
  List rows = [];
  Map latest = {};
  dynamic bmi;
  bool loaded = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final a = await apiGet('/vitals?type=$type'), b = await apiGet('/vitals/summary');
    if (!mounted) return;
    setState(() {
      rows = ok(a) ? jsonOf(a) as List : [];
      if (ok(b)) {
        latest = (jsonOf(b) as Map)['latest'] as Map? ?? {};
        bmi = (jsonOf(b) as Map)['bmi'];
      }
      loaded = true;
    });
  }

  Future<void> add() async {
    final v = TextEditingController(), v2 = TextEditingController(), note = TextEditingController();
    var context0 = 'fasting';
    final go = await showDialog<bool>(
      context: context,
      builder: (_) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          title: Text('Add ${vitalTypes[type]![0].toLowerCase()}'),
          content: SingleChildScrollView(
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              TextField(controller: v, keyboardType: const TextInputType.numberWithOptions(decimal: true), decoration: InputDecoration(labelText: type == 'bp' ? 'Upper number (systolic)' : vitalTypes[type]![1])),
              if (type == 'bp') TextField(controller: v2, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Lower number (diastolic)')),
              if (type == 'sugar')
                DropdownButton<String>(
                  value: context0,
                  isExpanded: true,
                  items: const [DropdownMenuItem(value: 'fasting', child: Text('Fasting')), DropdownMenuItem(value: 'after_meal', child: Text('After a meal'))],
                  onChanged: (x) => setD(() => context0 = x ?? 'fasting'),
                ),
              TextField(controller: note, maxLength: 120, decoration: const InputDecoration(labelText: 'Note (optional)')),
            ]),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        ),
      ),
    );
    if (go != true || !mounted) return;
    final r = await apiSend('POST', '/vitals', {'type': type, 'value': v.text.trim(), 'value2': v2.text.trim(), 'context': context0, 'note': note.text.trim()});
    if (!mounted) return;
    if (!ok(r)) snackOn(context, errOf(r));
    load();
  }

  Future<void> del(Map r) async {
    await apiSend('DELETE', '/vitals/${r['_id']}');
    load();
  }

  @override
  Widget build(BuildContext c) {
    final chart = rows.take(30).toList().reversed.toList();
    final a = [for (final r in chart) (r['value'] as num).toDouble()];
    final b = type == 'bp' ? [for (final r in chart) (r['value2'] as num).toDouble()] : null;
    final cur = latest[type];
    return Scaffold(
      appBar: AppBar(title: const Text('Health readings'), actions: const [BellButton()]),
      floatingActionButton: FloatingActionButton(tooltip: 'Add reading', onPressed: add, child: const Icon(Icons.add)),
      body: !loaded
          ? const Center(child: CircularProgressIndicator())
          : ListView(padding: const EdgeInsets.all(12), children: [
              Wrap(spacing: 8, children: [
                for (final k in vitalTypes.keys)
                  ChoiceChip(
                    label: Text(vitalTypes[k]![0]),
                    selected: type == k,
                    onSelected: (_) {
                      setState(() => type = k);
                      load();
                    },
                  ),
              ]),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Latest ${vitalTypes[type]![0].toLowerCase()}', style: Theme.of(c).textTheme.bodySmall),
                    Text(cur == null ? 'No reading yet' : showVital(cur as Map), style: Theme.of(c).textTheme.headlineSmall),
                    if (cur != null) statusText(c, (cur as Map)['status'] as String?),
                    if (type == 'weight' && bmi != null) Text('Body mass index: ${num2(bmi)}'),
                  ]),
                ),
              ),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: a.length < 2
                      ? const Text('Add at least two readings to see a chart.')
                      : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          SizedBox(height: 150, width: double.infinity, child: CustomPaint(painter: LinePainter(a, b, Theme.of(c).colorScheme.primary, Colors.grey))),
                          if (type == 'bp') Text('Colored line: upper number. Grey line: lower number.', style: Theme.of(c).textTheme.bodySmall),
                        ]),
                ),
              ),
              for (final r in rows.take(15))
                ListTile(
                  title: Text(showVital(r)),
                  subtitle: Text('${stamp(r['at'] ?? '')}${r['context'] == 'after_meal' ? ' · after a meal' : r['context'] == 'fasting' ? ' · fasting' : ''}${(r['note'] as String?)?.isNotEmpty == true ? ' · ${r['note']}' : ''}'),
                  trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                    statusText(c, r['status'] as String?),
                    IconButton(tooltip: 'Delete reading', icon: const Icon(Icons.delete_outline), onPressed: () => del(r)),
                  ]),
                ),
              Padding(
                padding: const EdgeInsets.all(8),
                child: Text('Usual ranges are general guides, not a diagnosis. Talk to your doctor about readings that worry you.', style: Theme.of(c).textTheme.bodySmall),
              ),
            ]),
    );
  }
}

// ---------- prescriptions ----------

class PrescriptionsPage extends StatefulWidget {
  const PrescriptionsPage({super.key});
  @override
  State<PrescriptionsPage> createState() => _PrescriptionsPageState();
}

class _PrescriptionsPageState extends State<PrescriptionsPage> {
  List items = [];
  bool loaded = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final r = await apiGet('/prescriptions/mine');
    if (!mounted) return;
    setState(() {
      items = ok(r) ? jsonOf(r) as List : [];
      loaded = true;
    });
  }

  Future<void> addReminders(Map p) async {
    final id = p['appointment']?['_id'];
    if (id == null) return;
    final r = await apiSend('POST', '/prescriptions/$id/reminders');
    if (!mounted) return;
    final added = ok(r) ? (jsonOf(r) as Map)['added'] ?? 0 : 0;
    snackOn(context, ok(r) ? (added > 0 ? '$added reminder(s) added. Check the Reminders tab.' : 'These medicines already have reminders.') : errOf(r));
  }

  @override
  Widget build(BuildContext c) => Scaffold(
        appBar: AppBar(title: const Text('Prescriptions')),
        body: !loaded
            ? const Center(child: CircularProgressIndicator())
            : items.isEmpty
                ? const Center(child: Text('No prescriptions yet.'))
                : ListView(padding: const EdgeInsets.all(8), children: [
                    for (final p in items)
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(p['doctor']?['name'] ?? 'Doctor', style: Theme.of(c).textTheme.titleMedium),
                            Text('${p['appointment']?['date'] ?? stamp(p['createdAt'] ?? '').substring(0, 10)}${(p['diagnosis'] as String?)?.isNotEmpty == true ? ' · ${p['diagnosis']}' : ''}', style: Theme.of(c).textTheme.bodySmall),
                            const SizedBox(height: 8),
                            for (final m in (p['medicines'] as List)) Text('• ${m['name']}${(m['dose'] as String?)?.isNotEmpty == true ? ' (${m['dose']})' : ''} for ${m['days']} day(s)'),
                            if ((p['notes'] as String?)?.isNotEmpty == true) Padding(padding: const EdgeInsets.only(top: 8), child: Text('Notes: ${p['notes']}')),
                            Align(alignment: Alignment.centerRight, child: TextButton.icon(onPressed: () => addReminders(p), icon: const Icon(Icons.alarm_add), label: const Text('Add to reminders'))),
                          ]),
                        ),
                      ),
                  ]),
      );
}

// ---------- profile ----------

Future<void> changePasswordDialog(BuildContext c) async {
  final cur = TextEditingController(), nw = TextEditingController();
  final go = await showDialog<bool>(
    context: c,
    builder: (_) => AlertDialog(
      title: const Text('Change password'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [
        TextField(controller: cur, obscureText: true, decoration: const InputDecoration(labelText: 'Current password')),
        TextField(controller: nw, obscureText: true, decoration: const InputDecoration(labelText: 'New password (6+ characters)')),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Change')),
      ],
    ),
  );
  if (go != true) return;
  final r = await apiSend('POST', '/auth/change-password', {'current': cur.text, 'password': nw.text});
  if (c.mounted) snackOn(c, ok(r) ? 'Password changed.' : errOf(r));
}

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});
  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final name = TextEditingController(), phone = TextEditingController(), dob = TextEditingController(), height = TextEditingController();
  final allergies = TextEditingController(), conditions = TextEditingController();
  String gender = '', blood = '', email = '';
  bool share = true, loaded = false;
  static const bloods = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final r = await apiGet('/auth/me');
    if (!mounted || !ok(r)) return;
    final u = jsonOf(r) as Map;
    setState(() {
      name.text = u['name'] ?? '';
      phone.text = u['phone'] ?? '';
      dob.text = u['dob'] ?? '';
      height.text = u['heightCm'] == null ? '' : num2(u['heightCm']);
      allergies.text = u['allergies'] ?? '';
      conditions.text = u['conditions'] ?? '';
      gender = u['gender'] ?? '';
      blood = u['bloodGroup'] ?? '';
      email = u['email'] ?? '';
      share = u['shareWithDoctors'] != false;
      loaded = true;
    });
  }

  Future<void> pickDob() async {
    final d = await showDatePicker(context: context, initialDate: DateTime.tryParse(dob.text) ?? DateTime(1990), firstDate: DateTime(1900), lastDate: DateTime.now());
    if (d != null) setState(() => dob.text = d.toIso8601String().substring(0, 10));
  }

  Future<void> save() async {
    final r = await apiSend('PATCH', '/auth/me', {
      'name': name.text.trim(), 'phone': phone.text.trim(), 'dob': dob.text, 'gender': gender, 'bloodGroup': blood,
      'heightCm': height.text.trim(), 'allergies': allergies.text, 'conditions': conditions.text, 'shareWithDoctors': share,
    });
    if (!mounted) return;
    if (ok(r)) (await SharedPreferences.getInstance()).setString('name', name.text.trim());
    snackOn(context, ok(r) ? 'Profile saved.' : errOf(r));
  }

  Future<void> deleteAccount() async {
    final pw = TextEditingController();
    final go = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete your account?'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('Your records, readings and reminders are erased and future visits are cancelled. This cannot be undone.'),
          TextField(controller: pw, obscureText: true, decoration: const InputDecoration(labelText: 'Enter your password to confirm')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep my account')),
          FilledButton(style: FilledButton.styleFrom(backgroundColor: Colors.red), onPressed: () => Navigator.pop(context, true), child: const Text('Delete')),
        ],
      ),
    );
    if (go != true || !mounted) return;
    final r = await apiSend('DELETE', '/auth/me', {'password': pw.text});
    if (!mounted) return;
    if (ok(r)) {
      await logout(context);
    } else {
      snackOn(context, errOf(r));
    }
  }

  @override
  Widget build(BuildContext c) => Scaffold(
        appBar: AppBar(title: const Text('My profile')),
        body: !loaded
            ? const Center(child: CircularProgressIndicator())
            : ListView(padding: const EdgeInsets.all(16), children: [
                TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name')),
                Padding(padding: const EdgeInsets.symmetric(vertical: 4), child: Text(email, style: Theme.of(c).textTheme.bodySmall)),
                TextField(controller: phone, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone')),
                TextField(controller: dob, readOnly: true, onTap: pickDob, decoration: const InputDecoration(labelText: 'Date of birth', suffixIcon: Icon(Icons.calendar_today))),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(
                    child: DropdownButton<String>(
                      value: gender,
                      isExpanded: true,
                      items: const [
                        DropdownMenuItem(value: '', child: Text('Gender: not said')),
                        DropdownMenuItem(value: 'female', child: Text('Female')),
                        DropdownMenuItem(value: 'male', child: Text('Male')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (v) => setState(() => gender = v ?? ''),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButton<String>(
                      value: blood,
                      isExpanded: true,
                      items: [for (final b in bloods) DropdownMenuItem(value: b, child: Text(b.isEmpty ? 'Blood group: not known' : b))],
                      onChanged: (v) => setState(() => blood = v ?? ''),
                    ),
                  ),
                ]),
                TextField(controller: height, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Height (cm)')),
                TextField(controller: allergies, maxLines: 2, decoration: const InputDecoration(labelText: 'Allergies')),
                TextField(controller: conditions, maxLines: 2, decoration: const InputDecoration(labelText: 'Long-term conditions')),
                SwitchListTile(contentPadding: EdgeInsets.zero, title: const Text('Let doctors I have booked see my health profile and readings'), value: share, onChanged: (v) => setState(() => share = v)),
                FilledButton(onPressed: save, child: const Text('Save profile')),
                const Divider(height: 32),
                OutlinedButton(onPressed: () => changePasswordDialog(c), child: const Text('Change password')),
                const SizedBox(height: 8),
                OutlinedButton(onPressed: () => logout(c), child: const Text('Log out')),
                const SizedBox(height: 8),
                TextButton(onPressed: deleteAccount, child: const Text('Delete my account', style: TextStyle(color: Colors.red))),
              ]),
      );
}

// ---------- More tab ----------

class MorePage extends StatelessWidget {
  const MorePage({super.key});

  void open(BuildContext c, Widget w) => Navigator.push(c, MaterialPageRoute(builder: (_) => w));

  @override
  Widget build(BuildContext c) => Scaffold(
        appBar: AppBar(title: const Text('More'), actions: const [BellButton()]),
        body: ListView(children: [
          ListTile(leading: const Icon(Icons.person_outline), title: const Text('My profile'), subtitle: const Text('Health profile, password, privacy'), onTap: () => open(c, const ProfilePage())),
          ListTile(leading: const Icon(Icons.description_outlined), title: const Text('Prescriptions'), subtitle: const Text('From your doctors, with one tap to add reminders'), onTap: () => open(c, const PrescriptionsPage())),
          ListTile(leading: const Icon(Icons.health_and_safety_outlined), title: const Text('Symptom checker'), onTap: () => open(c, const SymptomPage())),
          ListTile(leading: const Icon(Icons.notifications_outlined), title: const Text('Notifications'), onTap: () => open(c, const NotificationsPage())),
          const Divider(),
          ListTile(
            leading: const Icon(Icons.emergency, color: Colors.red),
            title: const Text('Call emergency services (112)'),
            onTap: () async {
              final ok1 = await launchUrl(Uri.parse('tel:112'));
              if (!ok1 && c.mounted) snackOn(c, 'Could not open the phone app. Dial 112 yourself.');
            },
          ),
          ListTile(leading: const Icon(Icons.logout), title: const Text('Log out'), onTap: () => logout(c)),
        ]),
      );
}
