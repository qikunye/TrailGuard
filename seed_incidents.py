"""
Run once to seed 20 incidents into Firestore via the incident-service.
Usage: python3 seed_incidents.py
"""
import json
import urllib.request
import urllib.error
import time

BASE_URL = "http://localhost:5004"

INCIDENTS = [
    # Trail 1 – MacRitchie Reservoir Trail (Singapore)
    {"trailId": 1, "userId": 10, "injuryType": "Sprained ankle",     "description": "Slipped on wet rocks near km 3, unable to bear weight",              "severity": 3, "photoUrl": "", "lat": 1.3401, "lng": 103.8456},
    {"trailId": 1, "userId": 22, "injuryType": "Heat exhaustion",     "description": "Hiker collapsed at exposed ridge, dizzy and nauseous",               "severity": 4, "photoUrl": "", "lat": 1.3412, "lng": 103.8471},
    {"trailId": 1, "userId":  7, "injuryType": "Minor cut",           "description": "Scraped arm on thorny bush, bleeding controlled with first aid",      "severity": 1, "photoUrl": "", "lat": 1.3398, "lng": 103.8449},
    {"trailId": 1, "userId": 34, "injuryType": "Knee pain",           "description": "Sharp pain in left knee on descent, possible meniscus issue",        "severity": 3, "photoUrl": "", "lat": 1.3425, "lng": 103.8480},
    {"trailId": 1, "userId": 55, "injuryType": "Blister",             "description": "Severe blisters on both feet, unable to continue hiking",            "severity": 2, "photoUrl": "", "lat": 1.3388, "lng": 103.8441},
    # Trail 2 – Bukit Timah Nature Reserve (Singapore)
    {"trailId": 2, "userId": 18, "injuryType": "Fracture (suspected)","description": "Hard fall on rocky terrain, wrist very swollen and deformed",       "severity": 5, "photoUrl": "", "lat": 1.3523, "lng": 103.7767},
    {"trailId": 2, "userId": 41, "injuryType": "Dehydration",         "description": "Ran out of water, cramping and becoming confused",                   "severity": 4, "photoUrl": "", "lat": 1.3508, "lng": 103.7751},
    {"trailId": 2, "userId":  9, "injuryType": "Back strain",         "description": "Slipped carrying heavy pack, lower back seized up completely",       "severity": 3, "photoUrl": "", "lat": 1.3535, "lng": 103.7784},
    {"trailId": 2, "userId": 63, "injuryType": "Insect sting",        "description": "Multiple bee stings, mild allergic reaction, no epipen available",  "severity": 4, "photoUrl": "", "lat": 1.3517, "lng": 103.7758},
    {"trailId": 2, "userId": 29, "injuryType": "Minor cut",           "description": "Slipped on wooden bridge, grazed shin and palm",                    "severity": 1, "photoUrl": "", "lat": 1.3500, "lng": 103.7743},
    # Trail 3 – Mount Kinabalu Summit Trail (Malaysia)
    {"trailId": 3, "userId":  5, "injuryType": "Altitude sickness",   "description": "Headache and vomiting at 2700 m, needs to descend immediately",     "severity": 4, "photoUrl": "", "lat": 6.0747, "lng": 116.5586},
    {"trailId": 3, "userId": 77, "injuryType": "Hypothermia (mild)",  "description": "Temperature dropped unexpectedly, shivering uncontrollably",        "severity": 4, "photoUrl": "", "lat": 6.0731, "lng": 116.5572},
    {"trailId": 3, "userId": 33, "injuryType": "Twisted knee",        "description": "Knee gave way on uneven rock face, can walk slowly with support",   "severity": 2, "photoUrl": "", "lat": 6.0758, "lng": 116.5601},
    {"trailId": 3, "userId": 12, "injuryType": "Exhaustion",          "description": "Hiker sat down and is unresponsive to encouragement to continue",   "severity": 3, "photoUrl": "", "lat": 6.0763, "lng": 116.5614},
    {"trailId": 3, "userId": 48, "injuryType": "Eye injury",          "description": "Twig snapped into eye, significant pain and persistent watering",   "severity": 3, "photoUrl": "", "lat": 6.0712, "lng": 116.5559},
    # Trail 4 – Penang Hill (Malaysia)
    {"trailId": 4, "userId":  2, "injuryType": "Sprained ankle",      "description": "Ankle rolled on loose gravel, moderate swelling",                   "severity": 2, "photoUrl": "", "lat": 5.4221, "lng": 100.2699},
    {"trailId": 4, "userId": 67, "injuryType": "Chest pain",          "description": "Hiker reported chest tightness and shortness of breath at summit",  "severity": 5, "photoUrl": "", "lat": 5.4238, "lng": 100.2715},
    {"trailId": 4, "userId": 14, "injuryType": "Blister",             "description": "Poorly fitted boots caused deep blisters, can hobble slowly",       "severity": 1, "photoUrl": "", "lat": 5.4208, "lng": 100.2685},
    {"trailId": 4, "userId": 38, "injuryType": "Muscle cramp",        "description": "Severe cramp in both calves, unable to walk without assistance",    "severity": 2, "photoUrl": "", "lat": 5.4245, "lng": 100.2728},
    {"trailId": 4, "userId": 91, "injuryType": "Head laceration",     "description": "Fell and hit head on rock, bleeding and brief loss of consciousness","severity": 5, "photoUrl": "", "lat": 5.4232, "lng": 100.2710},
]

def post(payload):
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/incidents",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())

ok = 0
for i, inc in enumerate(INCIDENTS, 1):
    try:
        result = post(inc)
        print(f"[{i:02d}/20] ✓  {result['incidentId']}  trail={inc['trailId']}  severity={inc['severity']}  {inc['injuryType']}")
        ok += 1
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"[{i:02d}/20] ✗  HTTP {e.code}: {body}")
    except Exception as e:
        print(f"[{i:02d}/20] ✗  {e}")
    time.sleep(0.2)

print(f"\nDone — {ok}/20 incidents written to Firestore.")
