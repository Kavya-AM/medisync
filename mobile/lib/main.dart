import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'pages.dart';

// Android emulator reaches your computer at 10.0.2.2. Use your PC's IP on a real phone.
const base = 'http://10.0.2.2:5000/api';

void main() => runApp(const MediSync());

class MediSync extends StatelessWidget {
  const MediSync({super.key});
  @override
  Widget build(BuildContext c) => MaterialApp(
    title: 'MediSync',
    theme: ThemeData(colorSchemeSeed: const Color(0xFF17A88A), useMaterial3: true),
    home: const Gate(),
  );
}

Future<Map<String, String>> headers() async {
  final p = await SharedPreferences.getInstance();
  return {'Content-Type': 'application/json', 'Authorization': 'Bearer ${p.getString('token') ?? ''}'};
}

// ---------- shared request helpers (used by more.dart) ----------
Future<http.Response> apiGet(String path) async => http.get(Uri.parse('$base$path'), headers: await headers());

Future<http.Response> apiSend(String method, String path, [Map? body]) async {
  final req = http.Request(method, Uri.parse('$base$path'))..headers.addAll(await headers());
  if (body != null) req.body = jsonEncode(body);
  return http.Response.fromStream(await req.send());
}

bool ok(http.Response r) => r.statusCode >= 200 && r.statusCode < 300;

dynamic jsonOf(http.Response r) {
  try {
    return jsonDecode(r.body);
  } catch (_) {
    return null;
  }
}

String errOf(http.Response r) {
  final j = jsonOf(r);
  return j is Map && j['error'] != null ? '${j['error']}' : 'Something went wrong';
}

void snackOn(BuildContext c, String m) => ScaffoldMessenger.of(c).showSnackBar(SnackBar(content: Text(m)));

/// Clears the saved login and returns to the login screen.
Future<void> logout(BuildContext c) async {
  final p = await SharedPreferences.getInstance();
  await p.remove('token');
  if (c.mounted) Navigator.of(c).pushAndRemoveUntil(MaterialPageRoute(builder: (context) => const Gate()), (route) => false);
}

class Gate extends StatefulWidget {
  const Gate({super.key});
  @override
  State<Gate> createState() => _GateState();
}

class _GateState extends State<Gate> {
  bool? loggedIn;
  @override
  void initState() {
    super.initState();
    SharedPreferences.getInstance().then((p) => setState(() => loggedIn = p.getString('token') != null));
  }

  @override
  Widget build(BuildContext c) {
    if (loggedIn == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    return loggedIn! ? const Shell() : Login(onDone: () => setState(() => loggedIn = true));
  }
}

class Login extends StatefulWidget {
  final VoidCallback onDone;
  const Login({super.key, required this.onDone});
  @override
  State<Login> createState() => _LoginState();
}

class _LoginState extends State<Login> {
  final name = TextEditingController(),
      email = TextEditingController(),
      pass = TextEditingController();
  String err = '';
  bool signup = false, busy = false;

  Future<void> submit() async {
    setState(() {
      err = '';
      busy = true;
    });
    try {
      final r = await http.post(
        Uri.parse('$base/auth/${signup ? 'register' : 'login'}'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          if (signup) 'name': name.text.trim(),
          'email': email.text.trim(),
          'password': pass.text,
        }),
      );
      final d = jsonDecode(r.body);
      if (r.statusCode == 200 || r.statusCode == 201) {
        (await SharedPreferences.getInstance()).setString('token', d['token']);
        widget.onDone();
      } else {
        setState(() => err =
            d['error'] ?? (signup ? 'Could not create account' : 'Login failed'));
      }
    } catch (_) {
      setState(() => err =
      'Cannot reach the server. Is it running? (npm run dev in the server folder)');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext c) => Scaffold(
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 80),
          Text('MediSync', style: Theme.of(c).textTheme.displaySmall),
          const SizedBox(height: 24),
          if (signup)
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Full name'),
            ),
          TextField(
            controller: email,
            keyboardType: TextInputType.emailAddress,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          TextField(
            controller: pass,
            obscureText: true,
            decoration: InputDecoration(
                labelText: signup ? 'Password (6+ characters)' : 'Password'),
          ),
          if (err.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(err, style: const TextStyle(color: Colors.red)),
            ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy ? null : submit,
            child: Text(busy
                ? 'Please wait...'
                : (signup ? 'Create account' : 'Log in')),
          ),
          TextButton(
            onPressed: () => setState(() {
              signup = !signup;
              err = '';
            }),
            child: Text(signup
                ? 'Already have an account? Log in'
                : 'New here? Create an account'),
          ),
        ],
      ),
    ),
  );
}

class Home extends StatefulWidget {
  const Home({super.key});
  @override
  State<Home> createState() => _HomeState();
}

class _HomeState extends State<Home> {
  List docs = [];
  @override
  void initState() {
    super.initState();
    http.get(Uri.parse('$base/doctors')).then((r) => setState(() => docs = jsonDecode(r.body)));
  }

  void snack(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> book(Map d) async {
    final day = await showDatePicker(context: context, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 60)));
    if (day == null || !mounted) return;
    final date = day.toIso8601String().substring(0, 10);
    final sr = await http.get(Uri.parse('$base/doctors/${d['_id']}/slots?date=$date'));
    if (!mounted) return;
    final List slots = sr.statusCode == 200 ? jsonDecode(sr.body) : [];
    if (slots.isEmpty) {
      snack('No free times on $date. Try another day.');
      return;
    }
    final time = await showModalBottomSheet<String>(
      context: context,
      builder: (_) => ListView(children: [for (final s in slots) ListTile(title: Text('$s'), onTap: () => Navigator.pop(context, '$s'))]),
    );
    if (time == null || !mounted) return;
    final r = await http.post(Uri.parse('$base/appointments'),
        headers: await headers(), body: jsonEncode({'doctor': d['_id'], 'date': date, 'time': time}));
    if (!mounted) return;
    snack(r.statusCode == 201 ? 'Appointment booked' : jsonDecode(r.body)['error']);
  }

  @override
  Widget build(BuildContext c) => Scaffold(
    appBar: AppBar(title: const Text('Find a doctor')),
    body: ListView(
      children: [
        for (final d in docs)
          ListTile(
            leading: CircleAvatar(child: Text(d['name'][4])),
            title: Text(d['name']),
            subtitle: Text('${d['specialty']} · ₹${d['fee']}'),
            trailing: FilledButton(onPressed: () => book(d), child: const Text('Book')),
          ),
      ],
    ),
  );
}