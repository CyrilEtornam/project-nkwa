# test-audio/send_call.py
import base64, json, sys, urllib.request

EC2 = "http://54.218.53.26:8000"

def send_call(audio_file, language, service_type="AMBULANCE", gps_lat=5.6037, gps_lon=-0.1870):
    audio = base64.b64encode(open(audio_file, "rb").read()).decode()
    body = json.dumps({
        "service_type": service_type,
        "language": language,
        "gps_lat": gps_lat,
        "gps_lon": gps_lon,
        "audio_base64": audio,
    }).encode()
    req = urllib.request.Request(
        f"{EC2}/api/v1/calls/initiate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            result = json.loads(r.read())
            print(json.dumps(result, indent=2))
            return result
    except urllib.error.HTTPError as e:
        err = json.loads(e.read())
        print(f"ERROR {e.code}:", json.dumps(err, indent=2))

if __name__ == "__main__":
    audio_file = sys.argv[1]
    language   = sys.argv[2]
    service    = sys.argv[3] if len(sys.argv) > 3 else "AMBULANCE"
    send_call(audio_file, language, service)
