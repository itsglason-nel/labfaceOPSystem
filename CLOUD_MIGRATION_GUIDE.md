# Cloud-Hybrid Migration Guide

## Objective
The goal is to transition the LabFace system from a vulnerable "Single-PC All-in-One" deployment to a highly available "Cloud-Hybrid" architecture.

In this model, the **Frontend, Backend, and Database** are hosted in the cloud (ensuring 24/7 uptime for professors and students to check attendance and manage accounts). Only the **AI Service and Cameras** remain on the local physical PC. If the local PC loses power or internet, the website remains fully operational; only live face scanning is temporarily paused.

## Current State vs. Target State

**Current State (Vulnerable)**
All services (NGINX, Next.js, Express, MariaDB, MinIO, FastAPI) run on a single PC. If that PC loses power, the website goes completely offline.

## Target State (Zero-Cost Cloud-Hybrid)
To achieve this without recurring monthly server costs, we utilize the generous free tiers of modern cloud providers.

1. **Frontend (Vercel)**: Next.js app running on Vercel's Edge Network (100% Free Hobby Tier).
2. **Backend API (Render or Koyeb)**: Node.js API hosted on Render Web Services (Free Tier). *Note: Render spins down after 15 minutes of inactivity (cold starts).* Koyeb is an alternative that offers a free tier with fewer sleep restrictions.
3. **Database (Aiven or TiDB Cloud)**: Managed MySQL/MariaDB database. Aiven offers a completely free MariaDB tier, and TiDB offers Serverless MySQL compatible DBs for free.
4. **Storage (Cloudflare R2 or Backblaze B2)**: Replace local MinIO with Cloudflare R2 (10GB free/month) or Backblaze B2 (10GB free).
5. **AI Edge Node (Local PC)**: The physical PC in the classroom runs *only* the Python AI Service. It pulls the camera feeds locally via RTSP.

## Implementation Steps

### 1. Database Migration (Free Tier: Aiven)
- Export the local MariaDB data: `mysqldump -u root -p labface > backup.sql`
- Create a free account on Aiven and provision a free MySQL instance.
- Import the data into the cloud instance using `mysql -u admin -p -h <aiven-host> labface < backup.sql`.

### 2. Storage Migration (Free Tier: Cloudflare R2)
- Sign up for Cloudflare and create an R2 bucket.
- R2 is fully S3-compatible. Update the Backend `.env` file to use the R2 endpoint, Access Key, and Secret Key instead of MinIO.

### 3. Backend Deployment (Free Tier: Render)
- Connect your GitHub repository to Render and create a new "Web Service".
- Set the build command (`npm install`) and start command (`npm start`).
- Add the cloud Database and Cloudflare R2 credentials to the Environment Variables tab.

### 4. Frontend Deployment (Free Tier: Vercel)
- Connect your GitHub repository to Vercel and import the `/frontend` directory.
- Set `NEXT_PUBLIC_API_URL` to point to the `*.onrender.com` URL of your Backend.

### 5. Configure the Local Edge Node (The AI Service)
- The local PC now *only* needs to run the AI Service.
- Use the newly created `docker-compose.local-ai.yml` file to spin up just the AI container on the PC.
- Update the AI Service `.env` file on the local PC to point `BACKEND_URL` to the public URL of your cloud-hosted Backend.
- **Security Check**: The AI Service must authenticate its requests to the cloud backend (e.g., using a secret API key or JWT) so that malicious actors cannot spoof attendance records.

## Handling Outages in the Hybrid Model
When the local PC goes down:
- **What works**: Students and professors can log in, view past attendance, update profiles, download reports, and file excuse letters. The website is fast and responsive.
- **What happens**: The `SessionModal` in the frontend should detect that the AI node is offline. It will cleanly block the professor from starting a "Live Face Scanning Session" and show a clear message: *"The classroom CCTV node is currently offline. Manual attendance fallback is required."*
