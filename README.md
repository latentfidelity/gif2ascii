<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1eDCCZhjLqW_h6ODN-J0vt1XowRZ26Gp1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`

## Environment

To enable Tenor search in the upload screen, add a `.env` file in the project root:

```
VITE_TENOR_API_KEY=your_tenor_key_here
```

Restart the dev server after setting the key.
