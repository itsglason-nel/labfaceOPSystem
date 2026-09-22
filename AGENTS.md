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

## Deployment & Architecture Target
LabFace is transitioning from a monolithic single-node deployment to a **Cloud-Hybrid Edge Architecture**:
- **Cloud Layer**: Next.js (Frontend), Node.js (Backend), MariaDB, and Cloud Object Storage. These must have 24/7 uptime.
- **Edge Layer**: Python FastAPI (`ai-service`). Runs on physical PCs in the classroom to process RTSP feeds locally.

### Offline / Edge Downtime Considerations
- If the local edge node (`ai-service` PC) is unreachable, the web platform **must remain online**.
- The frontend should proactively query the edge node's health (or the backend's registry of edge nodes) and gracefully disable CCTV-dependent features (like starting a live attendance session), while allowing users to browse their history and analytics.

## Setup & Run Commands
1. **Full Local Dev**:
   `./local-only.sh` (Spins up everything locally via `docker-compose.yml`).
2. **Production Cloud Deploy**:
   `./deploy.sh` (Use for deploying the web/API layer to a VPS or cloud provider).
3. **Edge Node Deploy (Classroom PC)**:
   Use `docker-compose.local-ai.yml` to spin up just the CCTV ingestion layer.

## Coding Conventions
- **Frontend**: Functional components, Tailwind for styling, `lucide-react` for icons. Break up large files (avoid the "god file" anti-pattern). Note: Currently missing `<meta name="viewport">` in root layout.
- **Backend**: Use `pool.query` for MariaDB. Migrate complex business logic out of `routes/` and into `services/`.
- **AI Service**: Avoid blocking the async event loop with heavy CV processing (use `run_in_executor`).

## Known Gotchas
- `test_ocr_logic.js` and `DeveloperCredits.tsx` are orphaned files and not hooked up.
- The `docker-compose.yml` sets up `ai-service` strictly via environment variables, relying on `.env`.
- Frontend UI relies on `navigator.onLine` and `sw.js` for offline modes. To truly block new sessions during an outage, the `SessionModal.tsx` needs to respond to both network failure *and* backend health check failures.
