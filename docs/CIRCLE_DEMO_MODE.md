# Circle demo — same interface, no backend

Run `npm run web:demo` for UI testing when Node/MySQL/email aren't ready.
The demo renders the **same UI and visual design** as the normal app. No special banners, imitation controls, explanatory popups or extra navigation links are inserted. The only difference is the data source and simplified testing behavior.

- Register with a made-up email and a test-only password. The demo signs you in and takes you straight to the main feed.
- Demo-created profiles and posts are kept in browser localStorage. They are not saved to MySQL or shared between browsers.
- Never enter a real password. Demo login accepts any non-empty password for a recognized test username.
- Real `npm run web` never silently switches to sample data when the API is unavailable. It shows a connection error.
- Real registration requires verifying a 20-minute code/link sent through SMTP; after verification and login the user lands on the main feed.

Some backend-driven functionality (actual email, account security, avatar uploads, moderation permissions) cannot be tested in demo mode. Test it with the real API, MySQL, and SMTP.

See `docs/REAL_EMAIL_VERIFICATION.md` for production email setup.
