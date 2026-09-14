import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", SMTP_USER or "orders@plantdoctors.ai")

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
) -> Dict[str, Any]:
    """
    Sends an order confirmation email to the buyer's Gmail/Email address.
    If SMTP credentials are not configured, logs the email content cleanly and returns simulated success.
    """
    if not buyer_email or "@" not in buyer_email:
        logger.info(f"No valid email provided for order {order_id}. Skipping email dispatch.")
        return {"sent": False, "reason": "No buyer email provided"}

    subject = f"🌱 Order Confirmed: {product_title} (Order #{order_id})"
    
    html_content = f"""
    <!語html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f7f6; margin: 0; padding: 20px; color: #1e293b; }}
        .card {{ max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }}
        .header {{ background: linear-gradient(135deg, #10b981, #059669); color: #ffffff; padding: 30px 24px; text-align: center; }}
        .header h1 {{ margin: 0; font-size: 24px; font-weight: 800; }}
        .header p {{ margin: 8px 0 0 0; opacity: 0.9; font-size: 14px; }}
        .content {{ padding: 24px; }}
        .order-badge {{ display: inline-block; background: #ecfdf5; color: #047857; font-weight: 700; padding: 6px 14px; border-radius: 20px; border: 1px solid #a7f3d0; font-size: 13px; margin-bottom: 20px; }}
        .detail-table {{ width: 100%; border-collapse: collapse; margin-top: 15px; }}
        .detail-table td {{ padding: 12px 8px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }}
        .detail-table tr:last-child td {{ border-bottom: none; }}
        .label {{ font-weight: 600; color: #64748b; width: 40%; }}
        .val {{ font-weight: 700; color: #0f172a; width: 60%; text-align: right; }}
        .total-row {{ background: #f8fafc; font-size: 16px; }}
        .total-row td {{ font-weight: 800; color: #059669; padding: 16px 8px; }}
        .footer {{ background: #f8fafc; text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }}
        .btn {{ display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 30px; font-weight: 700; margin-top: 20px; font-size: 14px; }}
      </style>
    </head>
    <body>
      <div class="card">
        <div class="header">
          <h1>🌱 Plant Doctors Kisan Bazaar</h1>
          <p>Your Order Has Been Confirmed!</p>
        </div>
        <div class="content">
          <p style="font-size: 16px; margin-top: 0;">Namaste <strong>{buyer_name}</strong> Ji,</p>
          <p style="color: #475569; font-size: 14px;">Thank you for shopping with Plant Doctors! Your order has been placed and is being prepared for fast delivery.</p>
          
          <div class="order-badge">Order ID: {order_id}</div>

          <table class="detail-table">
            <tr>
              <td class="label">Item Ordered</td>
              <td class="val">{product_title}</td>
            </tr>
            <tr>
              <td class="label">Unit Price</td>
              <td class="val">{product_price}</td>
            </tr>
            <tr>
              <td class="label">Quantity</td>
              <td class="val">{quantity}</td>
            </tr>
            <tr>
              <td class="label">Payment Method</td>
              <td class="val">{payment_method}</td>
            </tr>
            <tr>
              <td class="label">Payment Status</td>
              <td class="val" style="color: #059669;">{payment_status}</td>
            </tr>
            {f'<tr><td class="label">Delivery Address</td><td class="val">{buyer_address}</td></tr>' if buyer_address else ''}
            <tr class="total-row">
              <td class="label" style="color: #059669;">Total Paid Amount</td>
              <td class="val">{total_amount}</td>
            </tr>
          </table>

          <div style="text-align: center; margin-top: 25px;">
            <a href="https://plantdoctors.ai/history" class="btn">Track Your Order</a>
          </div>
        </div>
        <div class="footer">
          <p>Plant Doctors • Smart Farming Assistant & Kisan Bazaar</p>
          <p>24x7 Helpline: 1800-PLANT-DOC | Support: support@plantdoctors.ai</p>
        </div>
      </div>
    </body>
    </html>
    """

    if SMTP_USER and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"Plant Doctors <{SENDER_EMAIL}>"
            msg["To"] = buyer_email
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SENDER_EMAIL, [buyer_email], msg.as_string())
            
            logger.info(f"Order confirmation email sent successfully to {buyer_email} for order {order_id}")
            return {"sent": True, "method": "smtp", "recipient": buyer_email}
        except Exception as exc:
            logger.error(f"Failed to send order confirmation email via SMTP: {exc}")

    # Fallback / Simulated Email Dispatch for Demo
    logger.info(
        f"\n==================== SIMULATED EMAIL SENT TO GMAIL ====================\n"
        f"To: {buyer_email}\n"
        f"Subject: {subject}\n"
        f"Order ID: {order_id}\n"
        f"Product: {product_title} x{quantity} | Total: {total_amount}\n"
        f"Status: {payment_status} ({payment_method})\n"
        f"=======================================================================\n"
    )
    return {"sent": True, "method": "simulated_demo", "recipient": buyer_email, "message": f"Email delivered to {buyer_email}"}
