import requests
from math import radians, sin, cos, sqrt, atan2

def get_nearby_hospitals(lat, lon, radius=50000):
    query = f"""
    [out:json];
    node["amenity"="hospital"]
    (around:{radius},{lat},{lon});
    out body;
    """
    headers = {
        "User-Agent": "NeuraScan/1.0 (stroke detection app)"
    }
    try:
        response = requests.get(
            "https://overpass-api.de/api/interpreter",
            params={"data": query},
            headers=headers,
            timeout=30
        )
        print("Status:", response.status_code)
        data = response.json()
        return data["elements"]
    except Exception as e:
        print("Error:", e)
        return []

def haversine(lat1, lon1, lat2, lon2):
    R = 6371
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))

def nearest_hospital(user_lat, user_lon):
    hospitals = get_nearby_hospitals(user_lat, user_lon)
    
    nearest = min(hospitals,
                  key=lambda h: haversine(user_lat, user_lon, h["lat"], h["lon"]))
    
    distance = haversine(user_lat, user_lon, nearest["lat"], nearest["lon"])
    name = nearest.get("tags", {}).get("name", "Unknown Hospital")
    
    print(f"Nearest Hospital: {name}")
    print(f"Distance: {distance} km")
    print(f"Location: {nearest['lat']}, {nearest['lon']}")

# Test near Sathupalli
nearest_hospital(17.1167, 80.8167)