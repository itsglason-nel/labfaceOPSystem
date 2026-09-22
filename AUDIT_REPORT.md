# DEEP RESEARCH AUDIT — CCTV Face-Recognition Attendance System

## 1. Executive Summary
- **Single Point of Failure Confirmation**: The application heavily relies on a single-node setup via Docker Compose on a single PC. If this machine goes offline, the entire platform (DB, Backend, AI, UI) becomes unavailable.
- **Frontend Offline Vulnerability**: Next.js lacks a read-only cache of essential schedule data. The Service Worker caches assets, and IndexedDB queues mutation requests (OfflineQueueService), but the user cannot view cached dashboard data if the Node backend is unreachable.
- **Missing Viewport Tag**: The Next.js `layout.tsx` is completely missing the `<meta name="viewport" content="width=device-width, initial-scale=1" />` tag. This causes catastrophic rendering issues on mobile, breaking otherwise responsive Tailwind classes.
- **Backend "God Files"**: Several backend routes (e.g., `adminRoutes.js` at 1700+ lines, `authRoutes.js`, `studentRoutes.js`) contain significant amounts of business logic that should be refactored into modular services.
- **AI Service Optimization**: The RTSP capture runs via `asyncio` and `cv2` within a single FastAPI app. It is functional but tight coupling between bounding box tracking and the `video_feed` endpoint could become a bottleneck if scaling cameras.
- **Orphaned Files Detected**: We discovered standalone test scripts and disconnected React components that are not imported anywhere, indicating incomplete cleanup during development.

## 2. Project Structure & Organization Findings
- **Frontend (`/frontend`)**: Standard Next.js 14 App Router layout.
  - **Inconsistency**: The `components/` directory is overly flat. Massive domain-specific components (e.g., `SessionModal.tsx` at 82k bytes / ~1500 lines) sit alongside generic UI buttons.
- **Backend (`/backend`)**: Node.js / Express.
  - **Anti-pattern**: Severe "God files" in the `/routes` folder. Routes shouldn't hold SQL queries and complex data wrangling. Business logic is inconsistently split between `routes/` and `services/`.
- **AI Service (`/ai-service`)**: Python / FastAPI.
  - Logic is well-separated into `core/` (vision logic), `models/` (ML logic), and `services/` (analytics).
  - RTSP ingestion logic is coupled directly into `main.py` rather than a dedicated ingestion service.

## 3. Unused-File Table

| File | Referenced By | Verdict | Notes |
|------|---------------|---------|-------|
| `backend/services/test_ocr_logic.js` | None | Likely Unused | Standalone script for testing OCR logic, not imported or part of standard flow |
| `frontend/components/DeveloperCredits.tsx` | None | Likely Unused | Component not imported or routed in the application anywhere |
| `ai-service/download_models.py` | Dockerfile/deploy scripts | Used | Standalone script executed during docker build to pre-fetch ML models |
| `backend/scripts/seed_analytics.js` | None | Likely Unused | Standalone database seeding script, not imported into app code |
| `backend/scripts/scratch_audit.js` | None | Likely Unused | Standalone utility script |
| `backend/scripts/apply_batch_updates.js` | None | Likely Unused | Standalone utility script for batch updates |

## 4. Architecture Deep Dive

**Data Flow**:
1. **Camera Capture**: RTSP streams are ingested via OpenCV in `ai-service/main.py`.
2. **Face Detection & Recognition**: Bounding boxes are generated and fed into InsightFace (`face_recognition.py`) and matched against cached embeddings.
3. **Attendance Record Creation**: `attendance_logic.py` uses movement trends (area sizing) to detect ENTRY/EXIT, triggering HTTP POST to Node backend (`/api/attendance/mark`).
4. **Storage**: Images are pushed to MinIO; records to MariaDB.
5. **Retrieval**: Node backend serves this data to the Next.js frontend.

**Deployment Context**:
Based on `docker-compose.yml`, the application targets a single-node deployment (all containers on one machine). This makes the host PC a severe **Single Point of Failure**.

```mermaid
graph TD
    Cam[RTSP Camera Feed] -->|Video Stream| AI[AI Service: FastAPI]
    AI -->|Face Detection & Tracking| CV(InsightFace / Models)
    AI -->|POST /mark| BE[Backend Service: Node.js]
    BE -->|SQL| DB[(MariaDB)]
    BE -->|S3 Upload| MinIO[(MinIO Storage)]
    FE[Frontend: Next.js] <-->|REST API| BE
    FE <-->|Live Stream Image| AI
```

## 5. AGENTS.md Status
No existing AI agent instruction files (`AGENTS.md`, `CLAUDE.md`, or `.cursorrules`) were found. I have generated a comprehensive `AGENTS.md` at the root of the repository outlining the project architecture, deployment constraints, coding conventions, and known gotchas.

## 6. Server-Downtime Resilience Findings & Proposal

**Current Behavior**:
- The Next.js frontend has a service worker (`sw.js`) that precaches core assets and shows an `offline.html` page when offline.
- Mutations are queued via `OfflineQueueService` (IndexedDB).
- **Critical Flaw**: Because the Database and Backend API run on the exact same local PC as the CCTV AI service, a power outage in the classroom takes the entire website offline. The frontend cache cannot serve schedule or historical data if the user refreshes.

**Proposed Solution: Cloud-Hybrid Architecture**
To achieve high availability while keeping the heavy video processing local, the system must be split:
1. **Cloud Web Layer (24/7 Uptime)**: Migrate the Next.js Frontend, Node.js Backend, MariaDB, and MinIO storage to cloud providers (e.g., Vercel, Render, AWS). This ensures that students and professors can log in, view analytics, and manage profiles from anywhere, at any time, regardless of the classroom PC's status.
2. **Local Edge Node (AI Service)**: Keep the Python FastAPI `ai-service` running on the physical classroom PC. This node pulls the RTSP camera feed locally (saving massive bandwidth costs) and POSTs lightweight recognition hits up to the Cloud Backend.
3. **Graceful Degradation**: Update the `SessionModal.tsx` in the frontend so that when a professor attempts to start a class, it checks the health of the local AI node (either directly or via a cloud proxy). If the classroom PC is down, the frontend remains fully usable but disables the "Start Live CCTV Session" button, falling back to manual attendance.

*(A detailed step-by-step migration path is now available in `CLOUD_MIGRATION_GUIDE.md` and a specific edge-deployment file `docker-compose.local-ai.yml` has been created).*

## 7. Mobile UI Audit Findings

1. **CRITICAL: Missing Viewport Tag**. The Next.js `app/layout.tsx` is missing `<meta name="viewport" content="width=device-width, initial-scale=1" />`. This breaks all Tailwind responsive scaling on mobile devices. (Line 1 of `layout.tsx`).
2. **`SessionModal.tsx` Overflow**. The modal attempts to use massive absolute widths and complex padding that does not collapse gracefully on 375px viewports. The horizontal input layouts for "Schedule & Notify" wrap poorly.
3. **`ClassAnalytics.tsx` and `ClassDetailsModal.tsx` Tables**. The data tables are wrapped in `overflow-x-auto`, which is functionally okay but creates a cramped scroll experience on 375px-430px screens due to padding restrictions.
4. **Touch Targets**. Several buttons in `ClassDetailsModal.tsx` use `py-1.5` resulting in heights below the 44px iOS HIG recommendation.

## 8. Prioritized Recommendations

1. **Add Viewport Meta Tag**: Immediately insert the standard viewport meta tag in `frontend/app/layout.tsx`.
2. **Refactor Backend "God Files"**: Migrate the heavy SQL and business logic from `adminRoutes.js` and `authRoutes.js` into dedicated service files (e.g., `adminService.js`) to decouple routing from data access.
3. **Implement Read-Only Dashboard Cache**: Extend the existing `offlineDB.ts` (or introduce React Query) to store GET request payloads for the dashboard and schedule screens, fulfilling the offline resilience requirement.
4. **Block Offline Session Starts**: Add explicit health-check guards in `SessionModal.tsx` to prevent users from starting sessions when the `ai-service` or backend is unreachable.
5. **Component Consolidation**: Break down `SessionModal.tsx` (~1500 lines) into smaller, manageable subcomponents (e.g., `SessionScheduler`, `SessionImmediateStart`).
6. **Remove Orphaned Scripts**: Delete `backend/services/test_ocr_logic.js`, `frontend/components/DeveloperCredits.tsx`, and scratch pad scripts in `backend/scripts/` to clean the repository.

## Appendix: Full Recursive File Tree
```
$(tree -I "node_modules|venv|.git|__pycache__|.next|build|dist|.last_build")
```
