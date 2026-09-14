import logging
import os
import re
import json
import urllib.request
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

try:
    import resend
except ImportError:
    resend = None


from pathlib import Path
from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parents[3]
_ENV_PATH = _BACKEND_DIR / ".env"


def send_order_confirmation_email(
    buyer_email: str,
    buyer_name: str,
    order_id: str,
    product_title: str,
    product_price: str,
    quantity: int,
    total_amount: str,
    payment_method: str,
    payment_status: str,
    buyer_address: Optional[str] = None,
    order_date: Optional[str] = None,
    order_type: str = "buy",
    rental_days: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Dispatches a real transactional order confirmation email using Resend API.
    Supports both Direct Buy and Peer-to-Peer Rental receipts.
    """
    if _ENV_PATH.exists():
        load_dotenv(_ENV_PATH, override=True)
    else:
        load_dotenv(override=True)

    if not buyer_email or "@" not in buyer_email:
        logger.warning(f"Invalid recipient email provided for order {order_id}: '{buyer_email}'")
        return {"sent": False, "error": "Invalid recipient email address", "recipient": buyer_email}

    api_key = os.getenv("RESEND_API_KEY", "").strip()
    if not api_key:
        err_msg = "RESEND_API_KEY is not configured in backend environment (.env)."
        logger.warning(f"Order {order_id}: {err_msg}")
        return {"sent": False, "error": err_msg, "recipient": buyer_email}

    from_email = os.getenv("RESEND_FROM_EMAIL", "Plant Doctors <onboarding@resend.dev>").strip()
    formatted_time = order_date or datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p UTC")

    # Extract price calculations
    raw_num = re.sub(r"[^\d.]", "", str(product_price or "0"))
    unit_price = float(raw_num) if raw_num else 0.0
    mult = (rental_days or 1) if order_type == "rent" else (quantity or 1)
    subtotal_val = unit_price * mult
    subtotal_str = f"₹{int(subtotal_val):,}" if subtotal_val > 0 else product_price

    is_rent = order_type == "rent"
    subject = f"Kisan Peer Rental Confirmed — #{order_id}" if is_rent else f"Order Confirmed — #{order_id}"

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px 12px; color: #0f172a; line-height: 1.5; }}
    .container {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }}
    .header {{ background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; padding: 36px 28px; text-align: center; position: relative; }}
    .badge {{ display: inline-flex; items-center: center; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); color: #ffffff; font-weight: 800; padding: 6px 16px; border-radius: 20px; font-size: 12px; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 12px; }}
    .header h1 {{ margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; }}
    .header p {{ margin: 8px 0 0 0; opacity: 0.95; font-size: 14px; font-weight: 500; }}
    .body-content {{ padding: 32px 28px; }}
    .order-id-box {{ background: #f0fdf4; border: 1px dashed #86efac; border-radius: 16px; padding: 14px 18px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }}
    .order-id-label {{ font-size: 12px; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; }}
    .order-id-val {{ font-size: 18px; font-weight: 900; color: #14532d; font-family: monospace; }}
    .section-title {{ font-size: 14px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; }}
    .item-table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
    .item-table th {{ text-align: left; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; padding: 8px 0; border-bottom: 2px solid #f1f5f9; }}
    .item-table td {{ padding: 14px 0; border-bottom: 1px solid #f8fafc; font-size: 14px; }}
    .pricing-table {{ width: 100%; border-collapse: collapse; margin-top: 10px; background: #f8fafc; border-radius: 16px; padding: 16px; border: 1px solid #f1f5f9; }}
    .pricing-table td {{ padding: 8px 14px; font-size: 13px; color: #475569; }}
    .pricing-table tr.total-row td {{ font-size: 16px; font-weight: 900; color: #059669; border-top: 2px solid #e2e8f0; padding-top: 12px; padding-bottom: 12px; }}
    .info-grid {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
    .info-grid td {{ padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }}
    .info-label {{ font-weight: 700; color: #64748b; width: 35%; }}
    .info-val {{ font-weight: 600; color: #0f172a; width: 65%; }}
    .footer {{ background: #f8fafc; text-align: center; padding: 24px 28px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
    .footer a {{ color: #059669; text-decoration: none; font-weight: 700; }}
    .btn {{ display: inline-block; background: #059669; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 30px; font-weight: 800; margin-top: 24px; font-size: 14px; box-shadow: 0 4px 14px rgba(5,150,105,0.3); }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">✓ Order Confirmed</div>
      <h1>Plant Doctors Kisan Bazaar</h1>
      <p>Thank you for your order, {buyer_name}!</p>
    </div>

    <div class="body-content">
      <div class="order-id-box">
        <div>
          <div class="order-id-label">Confirmation Number</div>
          <div style="font-size: 12px; color: #15803d; margin-top: 2px;">{formatted_time}</div>
        </div>
        <div class="order-id-val">#{order_id}</div>
      </div>

      <div class="section-title">Order Items</div>
      <table class="item-table">
        <thead>
          <tr>
            <th style="width: 50%;">Product</th>
            <th style="width: 20%; text-align: center;">Qty</th>
            <th style="width: 30%; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="font-weight: 800; color: #0f172a;">{product_title}</td>
            <td style="text-align: center; font-weight: 700; color: #475569;">{quantity}</td>
            <td style="text-align: right; font-weight: 800; color: #0f172a;">{product_price}</td>
          </tr>
        </tbody>
      </table>

      <div class="section-title">Payment & Pricing Breakdown</div>
      <table class="pricing-table">
        <tr>
          <td>Subtotal</td>
          <td style="text-align: right; font-weight: 700;">{subtotal_str}</td>
        </tr>
        <tr>
          <td>Delivery / Shipping Charge</td>
          <td style="text-align: right; font-weight: 700; color: #059669;">FREE</td>
        </tr>
        <tr>
          <td>Discount</td>
          <td style="text-align: right; font-weight: 700;">₹0</td>
        </tr>
        <tr class="total-row">
          <td>Final Total Amount</td>
          <td style="text-align: right;">{total_amount}</td>
        </tr>
      </table>

      <div class="section-title">Customer & Delivery Information</div>
      <table class="info-grid">
        <tr>
          <td class="info-label">Customer Name</td>
          <td class="info-val">{buyer_name}</td>
        </tr>
        <tr>
          <td class="info-label">Customer Email</td>
          <td class="info-val">{buyer_email}</td>
        </tr>
        <tr>
          <td class="info-label">Delivery Address</td>
          <td class="info-val">{buyer_address or "Standard Shipping Address"}</td>
        </tr>
        <tr>
          <td class="info-label">Payment Method</td>
          <td class="info-val">{payment_method}</td>
        </tr>
        <tr>
          <td class="info-label">Payment Status</td>
          <td class="info-val" style="color: #059669; font-weight: 800;">{payment_status}</td>
        </tr>
        <tr>
          <td class="info-label">Estimated Delivery</td>
          <td class="info-val" style="color: #2563eb; font-weight: 700;">2-3 Business Days</td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 10px;">
        <a href="https://plantdoctors.ai/history" class="btn">Track Order Details</a>
      </div>
    </div>

    <div class="footer">
      <p style="font-weight: 700; margin-bottom: 4px;">Plant Doctors • Smart Agriculture & Kisan Bazaar</p>
      <p style="margin: 0;">24x7 Helpline: 1800-PLANT-DOC | Support: support@plantdoctors.ai</p>
    </div>
  </div>
</body>
</html>
"""

    payload = {
        "from": from_email,
        "to": [buyer_email.strip()],
        "subject": subject,
        "html": html_content,
    }

    # 1. Try Resend Python SDK if available
    if resend:
        try:
            resend.api_key = api_key
            res = resend.Emails.send({
                "from": from_email,
                "to": [buyer_email.strip()],
                "subject": subject,
                "html": html_content,
            })
            email_id = res.get("id") if isinstance(res, dict) else getattr(res, "id", str(res))
            logger.info(f"Order confirmation email sent via Resend SDK to {buyer_email} for order {order_id}. Resend ID: {email_id}")
            return {
                "sent": True,
                "method": "resend_sdk",
                "resend_id": email_id,
                "recipient": buyer_email,
            }
        except Exception as exc:
            logger.error(f"Resend SDK dispatch failed for order {order_id}: {exc}")

    # 2. Direct HTTP REST API call to https://api.resend.com/emails
    try:
        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "PlantDoctors-Backend/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req) as resp:
            resp_bytes = resp.read()
            data = json.loads(resp_bytes.decode("utf-8")) if resp_bytes else {}
            resend_id = data.get("id", "resend_ok")
            logger.info(f"Order confirmation email sent via Resend REST API to {buyer_email} for order {order_id}. Resend ID: {resend_id}")
            return {
                "sent": True,
                "method": "resend_rest",
                "resend_id": resend_id,
                "recipient": buyer_email,
            }
    except Exception as exc:
        err_detail = str(exc)
        if hasattr(exc, "read"):
            try:
                # Extract actual JSON error body from Resend API response
                err_body = exc.read().decode("utf-8")
                err_json = json.loads(err_body)
                err_detail = err_json.get("message") or err_body
            except Exception:
                pass
        logger.error(f"Resend API call failed for order {order_id}: {err_detail}")
        err_lower = err_detail.lower()
        test_mode_triggers = [
            "testing emails to your own email address",
            "testing email address",
            "testing email",
            "own email address",
            "verify a domain",
            "resend.com/domains",
            "domains like",
            "only send testing emails",
        ]

        if any(trigger in err_lower for trigger in test_mode_triggers):
            owner_email = os.getenv("RESEND_DEFAULT_RECIPIENT", "rdxayushpandey00@gmail.com").strip()
            if buyer_email.strip().lower() != owner_email.lower():
                logger.info(f"Resend testing restriction triggered for '{buyer_email}'. Retrying delivery to verified account owner '{owner_email}'.")
                retry_payload = dict(payload)
                retry_payload["to"] = [owner_email]
                try:
                    req_owner = urllib.request.Request(
                        "https://api.resend.com/emails",
                        data=json.dumps(retry_payload).encode("utf-8"),
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                            "User-Agent": "PlantDoctors-Backend/1.0",
                        },
                        method="POST",
                    )
                    with urllib.request.urlopen(req_owner) as resp_owner:
                        resp_bytes_owner = resp_owner.read()
                        data_owner = json.loads(resp_bytes_owner.decode("utf-8")) if resp_bytes_owner else {}
                        resend_id_owner = data_owner.get("id", "resend_ok")
                        logger.info(f"Fallback email delivered to owner ({owner_email}) for order {order_id}. Resend ID: {resend_id_owner}")
                        return {
                            "sent": True,
                            "method": "resend_rest_owner_fallback",
                            "resend_id": resend_id_owner,
                            "recipient": owner_email,
                            "note": f"Resend Free Tier test mode: Email sent to account owner ({owner_email}) instead of unverified recipient ({buyer_email}). Verify domain at resend.com/domains for custom recipients."
                        }
                except Exception as owner_exc:
                    logger.error(f"Fallback dispatch to owner failed: {owner_exc}")

        return {
            "sent": False,
            "error": f"Resend API Error: {err_detail}",
            "recipient": buyer_email,
        }
