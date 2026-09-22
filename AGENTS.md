# LabFace — AI Coding Assistant Instructions

## Overview
LabFace is a multi-tier, AI-powered Face Recognition Attendance System.
- **Frontend**: Next.js 14 (React) with Tailwind CSS. Deployed via Vercel or standalone container.
- **Backend**: Node.js/Express handling business logic, authentication, and database routing.
- **AI Service**: Python/FastAPI using InsightFace, handling RTSP CCTV stream ingestion and computer vision models.
- **Database**: MariaDB.
- **Storage**: MinIO (S3-compatible).

## Project Structure & Architecture
- `/frontend/`: Next.js app. Core UI lives in `app/` (app router). Reusable pieces in `components/`.
- `/backend/`: Node.js Express server. High concentration of logic currently mixed in `routes/`.
- `/ai-service/`: Python FastAPI. `core/` contains CV logic, `models/` contains ML implementations.
- **Docker**: `docker-compose.yml` models a single-machine local/production deployment. This machine represents a single point of failure.

## Offline / Server Downtime Considerations
- If `ai-service` is unreachable (Scenario A), the Next.js frontend and Node backend can still function, but live CCTV feeds and new attendance matching will fail.
- If the entire stack goes down (Scenario B), the `frontend` relies on a Service Worker (`sw.js`) and IndexedDB (`frontend/utils/offlineDB.ts`) to serve basic cached UI and queue operations (like profiles updates). *It does not currently support offline-read caching for schedule viewing.*

## Setup & Run Commands
1. **Local deployment**:
   `./local-only.sh` (wraps docker compose with fast builds and NGINX tunneling).
2. **Production deployment**:
   `./deploy.sh` (supports smart rebuilds and stable build IDs).
3. **Database Reset**:
   `docker exec -i labface_mariadb_1 mysql -uroot -p<password> labface < backend/init.sql`

## Coding Conventions
- **Frontend**: Functional components, Tailwind for styling, `lucide-react` for icons. Break up large files (avoid the "god file" anti-pattern). Note: Currently missing `<meta name="viewport">` in root layout.
- **Backend**: Use `pool.query` for MariaDB. Migrate complex business logic out of `routes/` and into `services/`.
- **AI Service**: Avoid blocking the async event loop with heavy CV processing (use `run_in_executor`).

## Known Gotchas
- `test_ocr_logic.js` and `DeveloperCredits.tsx` are orphaned files and not hooked up.
- The `docker-compose.yml` sets up `ai-service` strictly via environment variables, relying on `.env`.
- Frontend UI relies on `navigator.onLine` and `sw.js` for offline modes. To truly block new sessions during an outage, the `SessionModal.tsx` needs to respond to both network failure *and* backend health check failures.
