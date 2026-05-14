# Vayumukhi Dairy Website and Farm App

This project is a polished static prototype for a family-owned Indian dairy business.

## What is included

- Public marketing website with story, products, differentiation, and business potential.
- Private owner login section for daily farm operations.
- Minimal phone-first owner screen with today’s milk, sales, costs, balance, reminders, and AI advice.
- Daily milk production entry.
- Animal inventory view.
- Expense tracking for salaries, medication, feed, and miscellaneous costs.
- Customer purchase and daily sales tracking.
- Photo upload flow that simulates OCR extraction from handwritten production sheets.
- Voice/text assistant that converts simple farm phrases into structured entries.
- AI Monitor tab that checks whether daily production, sales, and expense entries are missing.
- WhatsApp-style in-app notification feed for new production, sales, expense, photo, and assistant entries.
- Reminder center for doctor visits, vaccinations, grass cutting, fodder cycles, and feed stock reviews.
- Owner intelligence brief that summarizes production movement, margin, demand, and care priorities.
- PWA metadata and service worker so the same app can evolve toward installable mobile use.

Prototype admin credentials:

- Username: `admin@vayumukhi.in`
- Password: `farm123`

Any non-empty username and password will sign in during this prototype stage.

## Production roadmap

To make this a real business system, the next build should add:

- Backend: PostgreSQL or Supabase for production, animals, customers, sales, and expenses.
- Authentication: role-based admin login with owner, manager, and worker permissions.
- OCR: Google Vision, Azure Document Intelligence, or OpenAI vision extraction for paper sheet uploads.
- LLM assistant: a server-side OpenAI workflow that validates extracted data before database creation.
- Agent scheduler: background jobs that run missing-entry checks every morning/evening and create alerts.
- Push notifications: Firebase Cloud Messaging for Android/web and Apple Push Notification service for iOS.
- Farm calendar: doctor visits, pregnancy checks, vaccination cycles, grass cutting, and feed plans.
- Mobile apps: wrap the PWA with Capacitor for Android/iOS, then publish through Play Store and App Store.
- Forecasting: sales and milk yield forecasting using historical production, season, feed, and customer demand.
- Audit logs: every data change should record user, timestamp, source, and approval state.

## Run locally

Open `index.html` directly in a browser, or serve the folder with:

```bash
python3 -m http.server 4174
```

Then visit:

```text
http://localhost:4174
```
