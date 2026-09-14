import urllib.request
import json
import logging

logging.basicConfig(level=logging.INFO)

def try_brevo(api_key, recipient):
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "accept": "application/json",
        "api-key": api_key,
        "content-type": "application/json"
    }
    payload = {
        "sender": {"name": "Plant Doctors Kisan Bazaar", "email": "orders@plantdoctors.ai"},
        "to": [{"email": recipient, "name": "Ayush Pandey"}],
        "subject": "🌱 Order Confirmed: Bayer Fungicide Plus (Order #KBZ-REAL)",
        "htmlContent": "<h1>🌱 Order Confirmed!</h1><p>Namaste Ayush Ji,</p><p>Your order for <strong>Bayer Fungicide Plus (₹450)</strong> has been placed!</p>"
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            print("Brevo success response:", resp.read().decode())
            return True
    except Exception as e:
        print("Brevo failed:", e)
        return False

def try_resend(api_key, recipient):
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": "Plant Doctors <onboarding@resend.dev>",
        "to": [recipient],
        "subject": "🌱 Order Confirmed: Bayer Fungicide Plus (Order #KBZ-REAL)",
        "html": "<h1>🌱 Order Confirmed!</h1><p>Namaste Ayush Ji,</p><p>Your order for <strong>Bayer Fungicide Plus (₹450)</strong> has been placed!</p>"
    }
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            print("Resend success response:", resp.read().decode())
            return True
    except Exception as e:
        print("Resend failed:", e)
        return False

if __name__ == "__main__":
    print("Testing mail APIs...")
