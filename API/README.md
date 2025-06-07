# Caritas Kosova & Mother Teresa Society Data Management Platform API

This repository contains the backend API for the Data Management Systems developed for Caritas Kosova (CK) and Mother Teresa Society (MTS). The system is designed to centralize program-related data, facilitate offline data collection, enable real-time monitoring, and provide reporting and analysis tools.

## System Architecture

- **Backend Database**: PostgreSQL
- **Application Backend**: Node.js with Express
- **Authentication**: JWT-based with RBAC (Role-Based Access Control) and Two-Factor Authentication (2FA)
- **Data Encryption**: AES-256 encryption at rest, TLS 1.2+ in transit

## Features

- User Management with Role-Based Access Control
- Program Management with multi-tier hierarchy
- Beneficiary Management
- Data Collection and Activity Tracking
- Offline Data Collection via PWA
- Reporting and Dashboards
- Statistics and Analytics
- Audit Logs and System Monitoring

## Getting Started

### Prerequisites

- Node.js (v16+)
- PostgreSQL (v12+)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example` with your configuration
4. Run the development server:
   ```
   npm run dev
   ```

### Database Setup

The application will automatically create the necessary tables when started. For a fresh installation, ensure your PostgreSQL database is running and accessible with the credentials provided in the `.env` file.

## API Documentation

The API follows RESTful principles and includes the following main endpoints:

- `/api/auth` - Authentication endpoints
- `/api/users` - User management
- `/api/programs` - Program management
- `/api/beneficiaries` - Beneficiary management
- `/api/activities` - Activity tracking
- `/api/reports` - Reporting endpoints

## Security

This API implements several security measures:

- JWT-based authentication
- Role-Based Access Control (RBAC)
- Password hashing with bcrypt
- Input validation
- Comprehensive audit logging

## License

This project is proprietary and confidential. Unauthorized copying, transferring, or reproduction of the contents of this project, via any medium, is strictly prohibited.

© 2025 Influxo SH.P.K & Besart Vllahinja B.I (Contractors)
