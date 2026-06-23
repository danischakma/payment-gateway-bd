# বিকাশ ও নগদ পেমেন্ট গেটওয়ে

Node.js + Express + PostgreSQL দিয়ে তৈরি একটি সম্পূর্ণ পেমেন্ট গেটওয়ে।
Render.com-এ বিনামূল্যে হোস্ট করা যাবে।

## পেজসমূহ
| পেজ | URL |
|-----|-----|
| হোমপেজ (পেমেন্ট শুরু) | `/` |
| পেমেন্ট পেজ | `/payment?order_id=ORD-...` |
| অ্যাডমিন প্যানেল | `/admin` |

## API Endpoints
| Method | Endpoint | কাজ |
|--------|----------|-----|
| POST | `/api/initiate` | পেমেন্ট শুরু |
| POST | `/api/verify-payment` | TRX যাচাই |
| POST | `/api/webhook/sms` | SMS Webhook |
| GET | `/api/order-status?order_id=` | স্ট্যাটাস চেক |
| GET | `/api/admin/orders` | অ্যাডমিন (Token লাগবে) |
| GET | `/api/config` | bKash/Nagad নম্বর |

## Deploy নির্দেশিকা
বিস্তারিত: [DEPLOYMENT.md](DEPLOYMENT.md) দেখুন।

## Embed করার পদ্ধতি
```html
<div data-pg-button data-pg-amount="500" data-pg-method="bkash"></div>
<script src="https://YOUR-APP.onrender.com/embed.js"></script>
```
