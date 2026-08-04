# Travelpayouts Flights setup

The Flights feature keeps Travelpayouts credentials in Firebase Secret Manager. Do **not** put either value in `.env`, `app.config.ts`, or an `EXPO_PUBLIC_*` variable: Expo embeds public variables in the app bundle.

From the repository root, configure the production project before deploying Functions:

```powershell
firebase functions:secrets:set TRAVELPAYOUTS_API_TOKEN
firebase functions:secrets:set TRAVELPAYOUTS_MARKER
firebase functions:secrets:set TRAVELPAYOUTS_PROJECT_ID
firebase deploy --only functions:searchFlights,functions:getFlightPriceCalendar,functions:createFlightBookingLink
```

For the Functions emulator only, create the ignored `functions/.secret.local` file:

```text
TRAVELPAYOUTS_API_TOKEN=your-token
TRAVELPAYOUTS_MARKER=your-affiliate-marker
TRAVELPAYOUTS_PROJECT_ID=your-trs-project-id
```

Redeploy the callables whenever any secret changes. When a user selects “View on Aviasales”, the app converts the full Aviasales URL through Travelpayouts’ Partner Links API using the marker and project ID (`trs`); it then opens the returned affiliate link. No secret is returned to the app.
