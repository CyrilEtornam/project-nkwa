import base64, json, urllib.request, time

EC2 = "http://54.218.53.26:8000"
PASS = "✓"
FAIL = "✗"

def call(audio_file, language, service_type="AMBULANCE"):
    audio = base64.b64encode(open(audio_file, "rb").read()).decode()
    body = json.dumps({
        "service_type": service_type, "language": language,
        "gps_lat": 5.6037, "gps_lon": -0.1870, "audio_base64": audio,
    }).encode()
    req = urllib.request.Request(
        f"{EC2}/api/v1/calls/initiate", data=body,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

results = []

tests = [
    ("EN fire (CRITICAL)",    "English/fireTestEnglish.mp3",  "en",  "FIRE",      202),
    ("EN medical (CRITICAL)", "English/medicalTestEnglish.mp3","en", "AMBULANCE", 202),
    ("EN prank (PRANK)",      "English/prankTestEnglish.mp3", "en",  "AMBULANCE", 202),
    ("EWE fire (CRITICAL)",   "Ewe/fireTestEwe.mp3",          "ee",  "FIRE",      202),
    ("TWI call (CRITICAL)",   "Twi/khayaTestTwi.mp3",         "tw",  "AMBULANCE", 202),
    ("TWI OGG format",        "Twi/test2.ogg",                "tw",  "AMBULANCE", 202),
    ("TWI FLAC format",       "Twi/test3.flac",               "tw",  "AMBULANCE", 202),
]

print(f"\n{'─'*65}")
print(f"  Nkwa Pipeline Tests  →  {EC2}")
print(f"{'─'*65}")

for name, audio, lang, svc, expected_status in tests:
    t0 = time.time()
    status, resp = call(audio, lang, svc)
    elapsed = time.time() - t0
    ok = status == expected_status
    call_id = resp.get("call_id", "")
    triage   = resp.get("status", resp.get("detail", "—"))
    url      = "✓ url" if resp.get("first_aid_audio_url") else "no url"
    icon = PASS if ok else FAIL
    print(f"  {icon}  {name:28}  [{status}]  {triage:18}  {url}  ({elapsed:.1f}s)")
    results.append((name, ok, elapsed, resp))

print(f"{'─'*65}")
passed = sum(1 for _, ok, _, _ in results if ok)
total  = len(results)

# Stats
try:
    r = urllib.request.urlopen(f"{EC2}/api/v1/calls/stats", timeout=10)
    stats = json.loads(r.read())
    print(f"\n  Stats today:  total={stats['total_calls_today']}  "
          f"emergencies={stats['real_emergencies_today']}  "
          f"pranks={stats['pranks_filtered_today']}  "
          f"avg_time={stats['avg_pipeline_duration_seconds']}s")
except Exception as e:
    print(f"\n  Stats: could not fetch ({e})")

print(f"\n  Result: {passed}/{total} passed")
print(f"{'─'*65}\n")
