# SuperDrive Frontend (React)

A lightweight React frontend for SuperDrive with an Ocean Professional theme (blue and amber accents), providing:
- Auth UI (Offline: Guest by default; optional static users via REACT_APP_SUPERDRIVE_USERS)
- Directory browser with breadcrumb navigation
- File actions: upload (drag-and-drop), download, create folder, rename, delete
- Settings panel with Offline Mode indicator and "Clear Local Data"
- Basic toasts and loading indicators

## Run

- npm start — dev mode on http://localhost:3000
- npm run build — production build
- npm run preview — build then serve static build via Node server.js

## Offline Mode

This app now runs fully client-side. Files and folders are stored in the browser using IndexedDB, and authentication is guest-only by default. You can provide static users at build time with:

- REACT_APP_SUPERDRIVE_USERS='[{"username":"admin","password":"admin"}]'

In Offline Mode, there are no network calls to /api; the previous API client is stubbed.

To clear all local data, open Settings and click "Clear Local Data".

## Environment

The following variables are read for display or optional configuration:
- REACT_APP_SUPERDRIVE_USERS — optional JSON array of local users for client-only auth
- REACT_APP_WS_URL — optional WebSocket URL (not used in Offline Mode)
- REACT_APP_FRONTEND_URL — optional frontend URL

## Notes

- Files are stored locally in the browser; clearing site data will remove them.
- A toast system surfaces success and error notifications.
