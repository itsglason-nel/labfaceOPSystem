# Cloud-Hybrid Migration Guide

## Objective
The goal is to transition the LabFace system from a vulnerable "Single-PC All-in-One" deployment to a highly available "Cloud-Hybrid" architecture.

In this model, the **Frontend, Backend, and Database** are hosted in the cloud (ensuring 24/7 uptime for professors and students to check attendance and manage accounts). Only the **AI Service and Cameras** remain on the local physical PC. If the local PC loses power or internet, the website remains fully operational; only live face scanning is temporarily paused.

## Current State vs. Target State

**Current State (Vulnerable)**
All services (NGINX, Next.js, Express, MariaDB, MinIO, FastAPI) run on a single PC. If that PC loses power, the website goes completely offline.

**Target State (Cloud-Hybrid)**
1. **Frontend (Vercel / Cloudflare Pages)**: Next.js app running on a global CDN.
2. **Backend & Database (Render / Railway / Supabase)**: Node.js API and MariaDB hosted in the cloud.
3. **Storage (AWS S3 / Cloudflare R2)**: Replace local MinIO with cloud object storage.
4. **AI Edge Node (Local PC)**: The physical PC in the classroom runs *only* the Python AI Service. It pulls the camera feeds locally, performs face recognition, and sends lightweight HTTP POST requests to the Cloud Backend (`/api/attendance/mark`).

## Implementation Steps

### 1. Database Migration
- Export the local MariaDB data: `mysqldump -u root -p labface > backup.sql`
- Provision a cloud MySQL/MariaDB instance (e.g., Aiven, DigitalOcean, AWS RDS).
- Import the data into the cloud instance.

### 2. Storage Migration
- Set up an AWS S3 bucket or Cloudflare R2 bucket.
- Update the Backend `.env` file to use the new cloud credentials instead of the local MinIO endpoint.

### 3. Backend & Frontend Deployment
- Deploy the Node.js backend to a cloud provider (e.g., Render, Railway, Heroku). Configure it to connect to the new cloud Database and Storage.
- Deploy the Next.js frontend to Vercel. Set `NEXT_PUBLIC_API_URL` to point to the cloud Backend URL.

### 4. Configure the Local Edge Node (The AI Service)
- The local PC now *only* needs to run the AI Service.
- Use the newly created `docker-compose.local-ai.yml` file to spin up just the AI container on the PC.
- Update the AI Service `.env` file on the local PC to point `BACKEND_URL` to the public URL of your cloud-hosted Backend.
- **Security Check**: The AI Service must authenticate its requests to the cloud backend (e.g., using a secret API key or JWT) so that malicious actors cannot spoof attendance records.

## Handling Outages in the Hybrid Model
When the local PC goes down:
- **What works**: Students and professors can log in, view past attendance, update profiles, download reports, and file excuse letters. The website is fast and responsive.
- **What happens**: The `SessionModal` in the frontend should detect that the AI node is offline. It will cleanly block the professor from starting a "Live Face Scanning Session" and show a clear message: *"The classroom CCTV node is currently offline. Manual attendance fallback is required."*
