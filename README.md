<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/54604a5c-c493-4ffe-842e-006b92fd1bde

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Virtual Office (AI workforce)

Sign in as the Super Admin (`admin@agricooph.com` / `admin123` in the seed data) and open **Virtual Office** in the sidebar. Click **Commission implementation report** to watch twelve AI employees across six departments research the live database, hand off findings, meet, and ask you for approvals before publishing the report.

See [docs/VIRTUAL_OFFICE.md](docs/VIRTUAL_OFFICE.md) for states, architecture, API and configuration.
