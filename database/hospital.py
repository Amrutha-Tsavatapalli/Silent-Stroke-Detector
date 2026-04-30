import json
from math import radians, sin, cos, sqrt, atan2

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

def nearest_hospital(user_lat, user_lon):
    with open("hospitals.json") as f:
        hospitals = json.load(f)
    
    hospitals_with_thrombolysis = [h for h in hospitals if h["has_thrombolysis"]]
    
    nearest = min(hospitals_with_thrombolysis, 
                  key=lambda h: haversine(user_lat, user_lon, h["lat"], h["lon"]))
    
    distance = haversine(user_lat, user_lon, nearest["lat"], nearest["lon"])
    return nearest, round(distance, 2)

# Test
hospital, dist = nearest_hospital(17.1167, 80.8167)
print(f"Nearest: {hospital['name']} — {dist} km away")
print(f"Phone: {hospital['phone']}")