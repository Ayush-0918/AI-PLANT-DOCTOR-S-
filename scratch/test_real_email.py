import smtplib
import socket
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import urllib.request
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_send_email():
    recipient = "ayushpandey10851@gmail.com"
    subject = "🌱 Order Confirmed: Bayer Fungicide Plus (Order #KBZ-TEST99)"
    body = "Namaste Ayush Ji,\n\nYour order for Bayer Fungicide Plus (₹450) has been successfully confirmed on Plant Doctors Kisan Bazaar!\n\nOrder ID: KBZ-TEST99\nDelivery Address: Jalandhar, Punjab\nPayment: Confirmed\n\nThank you for choosing Plant Doctors!"

    # Strategy 1: Try sending via free email API service or Webhook (e.g. Formspree / Webhook / Resend demo)
    try:
        data = json.dumps({
            "email": recipient,
            "name": "Ayush Pandey",
            "subject": subject,
            "message": body
        }).encode('utf-8')
        req = urllib.request.Request("https://formspree.io/f/xbjnqkyw", data=data, headers={"Content-Type": "application/json", "User-Agent": "PlantDoctorsApp/1.0"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            logger.info(f"Formspree status: {resp.status}")
    except Exception as e:
        logger.warning(f"Formspree attempt: {e}")

    # Strategy 2: Try direct SMTP to Google MX (gmail-smtp-in.l.google.com) on Port 25
    try:
        mx_host = "gmail-smtp-in.l.google.com"
        msg = MIMEMultipart()
        msg['From'] = "Plant Doctors Kisan Bazaar <orders@plantdoctors.ai>"
        msg['To'] = recipient
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP(mx_host, 25, timeout=10) as server:
            server.helo("plantdoctors.ai")
            server.sendmail("orders@plantdoctors.ai", [recipient], msg.as_string())
            logger.info("Direct MX email sent successfully to Gmail!")
            return True
    except Exception as e:
        logger.error(f"MX Direct SMTP failed: {e}")
        return False

if __name__ == "__main__":
    test_send_email()
