import requests
import json

url = "http://localhost:8000/chat"
payload = {
    "message": "We should finish the report by Friday.",
    "history": []
}

try:
    print(f"Sending request to {url}...")
    res = requests.post(url, json=payload)
    print(f"Status Code: {res.status_code}")
    if res.status_code == 200:
        print("Response:", res.json())
    else:
        print("Error Response:", res.text)
except Exception as e:
    print(f"Request failed: {e}")
