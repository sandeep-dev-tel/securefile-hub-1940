# SuperDrive Frontend (React)

A lightweight React frontend for SuperDrive with an Ocean Professional theme (blue and amber accents), providing:
- Auth UI
- Directory browser with breadcrumb navigation
- File actions: upload (drag-and-drop), download, create folder, rename, delete
- Settings panel to view configured API URLs
- Basic toasts and loading indicators

## Run

- npm start — dev mode on http://localhost:3000
- npm run build — production build
- npm run preview — build then serve static build via Node server.js

In monolith mode, the Node server in server.js serves the API under /api and static build in production.

## Environment

The app reads API endpoints from environment variables:
- REACT_APP_API_BASE — full base URL including optional /api (client appends /api if not present)
- REACT_APP_BACKEND_URL — alternative base when REACT_APP_API_BASE is not set
- REACT_APP_WS_URL — optional WebSocket URL
- REACT_APP_FRONTEND_URL — optional frontend URL reference

When unset, API calls default to same-origin /api.

## Notes

- Upload uses multipart with field "files" (multer.array("files"))
- All operations are restricted to the server-side configured ROOT_DIR
- A toast system surfaces success and error notifications
