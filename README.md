# WhatsApp-4 (React + Vite + Firebase + Gemini)

## Overview
WhatsApp-4 is a React (TypeScript) web application built with Vite. It integrates:
- **Firebase** (Auth, Firestore, Storage, Messaging)
- **Google Gemini** via the `@google/genai` SDK for AI features (chat summarization, smart replies, task extraction, etc.)
- **TailwindCSS** for styling

## Tech Stack
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** TailwindCSS
- **AI:** `@google/genai`
- **Backend-as-a-service:** Firebase SDK
- **Build:** Vite

## Prerequisites
- Node.js (recommended: LTS)
- A Firebase project
- A Gemini API key

## Setup
### 1) Install dependencies
```bash
npm install
```

### 2) Configure Firebase
This project expects a Firebase config file:
- `firebase-applet-config.json`

That file should contain the standard Firebase web config values, including:
- `projectId`
- `appId`
- `apiKey`
- `authDomain`
- `firestoreDatabaseId`
- `storageBucket`
- `messagingSenderId`

> The app reads it in `src/lib/firebase.ts`.

### 3) Configure Gemini API key
Set an environment variable:
- `GEMINI_API_KEY`

The Vite config injects it at build time (see `vite.config.ts`).

#### Using a `.env` file (recommended)
Create a file named `.env` in the project root:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4) (Optional) Firebase Emulator / Rules
This repo includes:
- `firestore.rules`
- `storage.rules`

You can adjust them to match your Firestore/Storage usage.

## Run Locally
### Development server
```bash
npm run dev
```

By default it runs on:
- **http://localhost:3000**

### Production build
```bash
npm run build
```

### Preview / Serve built app
```bash
npm run start
```

## Lint / Typecheck
```bash
npm run lint
```

## Project Structure (high-level)
- `src/components/` — UI components (login, chat, sidebar, modals, whiteboard, etc.)
- `src/context/` — React contexts for auth/calling state
- `src/services/` — Firebase/AI service layer
  - `geminiService.ts` — Gemini operations
  - `chatService.ts`, `callService.ts`, `whiteboardService.ts`
- `src/lib/` — shared helpers (`firebase.ts`, `utils.ts`, `errorHandler.ts`)

## Notes
- AI features may return fallback messages if `GEMINI_API_KEY` is missing.
- Firebase connection issues may appear if Firestore connectivity is not configured.

## Firebase + Gemini Endpoints (what the app does)
`src/services/geminiService.ts` provides:
- **summarizeChat** — summarizes a chat into a concise paragraph
- **suggestSmartReplies** — returns 3 JSON smart replies
- **generateTaskDetails** — extracts a JSON `{ title, category }`
- **improveWriting** — rewrites messages to a selected tone
- **transcribeAudio** — transcribes `audio/webm` base64 audio

## Author
Built as part of the WhatsApp-4 assignment/workflow.

