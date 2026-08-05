# Donat Dankau POS

![Donat Dankau](assets/donat-dankau-logo.png)

Donat Dankau POS is a point-of-sale application designed to support the daily operations of Donat Dankau outlets. It brings sales, inventory, expense tracking, cashier shifts, and business reporting together in one application that runs on Android, iOS, and the web.

This repository contains the client application built with Expo and React Native. Application data and business rules are managed by the [Donat Dankau POS Backend](https://github.com/Morr3r/donatdankaupos-be).

## User roles

The application provides role-based access:

- **Staff and cashiers** can manage shifts, create orders, accept payments, review transactions, and monitor inventory.
- **Owners** can monitor dashboards and reports, manage products, adjust inventory, record or cancel expenses, and oversee operational activity.

## Key features

- **Point of sale and checkout**: product and variant selection, reseller pricing, minimum order quantities, promotions, order notes, and multiple payment methods.
- **Daily shifts**: opening cash and bank balances, shift activity summaries, and end-of-shift reconciliation.
- **Transactions**: order history and details, deferred payment settlement, cancellations, refunds, invoice sharing, and receipt printing through Android thermal printers.
- **Inventory**: physical stock monitoring for Medium, Large, Mini, and Bomboloni products, stock entries with expiration dates, and owner-authorized adjustments.
- **Products**: menu, category, image, variant, standard price, reseller price, package size, and availability management.
- **Expenses**: expense recording by cash or bank funding source, with cancellation records retained for auditing.
- **Dashboard and reports**: sales summaries, payment breakdowns, top-selling products, cost of goods sold, net profit, and period-based report exports.
- **Operational notifications**: transaction alerts, inventory updates, reminders, badges, sounds, and direct navigation to the relevant screen.

## Operational workflow

1. A user signs in with a staff or owner account.
2. The cashier opens a shift. Cash and bank balances are carried from the previous shift automatically and can be adjusted when an external deposit or withdrawal occurs.
3. An order is created from the POS screen and paid by cash, QRIS, card, bank transfer, or deferred payment.
4. Inventory is reduced automatically based on the number of items sold and restored when a transaction is refunded.
5. The owner monitors sales, inventory, expenses, cost of goods sold, and profit through the dashboard and reports.
6. At the end of the operating day, the cashier closes the shift and reconciles the actual balances against the system totals.

## Technology stack

- Expo SDK 57 and React Native 0.86
- TypeScript and React 19
- React Navigation for application navigation
- Zustand for state management
- Zod for API data validation
- AsyncStorage and SecureStore for local storage
- Expo Notifications for push notifications
- A Kotlin-based native Expo module for Android thermal printers

## Running the application

Prerequisites:

- Node.js 22.13 or later
- npm
- Access to a running Donat Dankau POS backend
- Android Studio or Xcode for native builds, when required

```powershell
git clone https://github.com/Morr3r/donatdankaupos-fe.git
Set-Location donatdankaupos-fe
npm install
Copy-Item .env.example .env
npm start
```

Select Android, iOS, or web from the Expo CLI. Native features such as remote push notifications and thermal printing must be tested with a development or preview build rather than Expo Go.


## Development commands

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Expo development server. |
| `npm run android` | Build and run the Android development variant. |
| `npm run android:release` | Build and run the Android release variant. |
| `npm run ios` | Run the iOS application. |
| `npm run web` | Run the web application. |
| `npm run typecheck` | Check TypeScript types without emitting build files. |
| `npm run doctor` | Check Expo dependencies and project configuration. |

## Project structure

```text
.
|-- assets/                 # Logos, icons, and application media
|-- docs/                   # Backend contract and design references
|-- modules/thermal-printer # Native Expo module for Android printers
|-- plugins/                # Expo config plugins
|-- src/
|   |-- api/                # HTTP client and API services
|   |-- components/         # Shared UI and POS components
|   |-- navigation/         # Stack, tab, and deep-link navigation
|   |-- notifications/      # Push notification registration and handling
|   |-- screens/            # Application screens
|   |-- storage/            # Local session persistence
|   |-- store/              # Global application state
|   |-- theme/              # Design tokens
|   |-- types/              # Domain types
|   `-- utils/              # Formatters and shared utilities
|-- App.tsx                 # Root component
|-- app.json                # Expo configuration
`-- eas.json                # EAS Build profiles
```

## Push notifications

Remote push notifications use `expo-notifications` and the Expo Push Service. After sign-in, the application requests notification permission, registers the Expo Push Token with the backend, and updates it whenever the native FCM or APNs token changes. Notification payloads can open the relevant transaction, inventory view, or Notification Center.

### Android and FCM

1. Register the Android application in Firebase.
2. Save the Android configuration file from Firebase as `google-services.json` in the project root.
3. Ensure that `expo.android.googleServicesFile` in `app.json` points to that file.
4. Upload the FCM V1 Google Service Account Key through EAS Credentials. Never commit the service-account key.
5. Create a device build with `eas build --platform android --profile preview`.


## Build checks

Run the following checks before creating a native build:

```powershell
npm run typecheck
npm run doctor
```

EAS profiles are available for development, preview, and production builds:

```powershell
eas build --platform android --profile preview
eas build --platform android --profile production
```

## License

See [LICENSE](LICENSE) for the source code licensing terms.
