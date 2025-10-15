# CK-MTS Backend Docker Setup

This directory contains the Docker configuration for the CK-MTS backend API.

## Files Created

- `Dockerfile` - Container configuration for the Node.js API
- `docker-compose.yml` - Multi-service setup with PostgreSQL and API
- `env.example` - Environment variables template

## Services

### PostgreSQL Database
- **Container**: `ck-mts-postgres`
- **Port**: 5433 (mapped from internal 5432)
- **Database**: `ck_mts`
- **User**: `ck_mts_user`
- **Password**: `ck_mts_password_2025`

### Database Initialization
- **Container**: `ck-mts-db-init`
- **Purpose**: Runs database seeding only once
- **Dependencies**: Waits for PostgreSQL to be healthy
- **Restart Policy**: No restart (runs once and exits)

### API Application
- **Container**: `ck-mts-app`
- **Port**: 3010
- **Dependencies**: Waits for PostgreSQL and database initialization
- **Health Check**: HTTP endpoint `/health`

## Quick Start

1. **Navigate to the API directory**:
   ```bash
   cd CK_MTS/API
   ```

2. **Start all services**:
   ```bash
   docker-compose up -d
   ```

3. **View logs**:
   ```bash
   # View all logs
   docker-compose logs -f
   
   # View specific service logs
   docker-compose logs -f app
   docker-compose logs -f postgres
   ```

4. **Stop services**:
   ```bash
   docker-compose down
   ```

## Environment Variables

The application uses the following environment variables (already configured in docker-compose.yml):

- **Database**: PostgreSQL connection details
- **Security**: JWT and session secrets
- **Email**: SMTP configuration for Gmail
- **CORS**: Allowed origins for frontend
- **Encryption**: Keys for beneficiary data encryption

## Database Seeding

The database seeding happens automatically through the `db-init` service:
- Runs only once when containers are first created
- Populates the database with initial roles, users, and data
- Uses the `npm run seed` command

## Volumes

- `postgres_data`: Persistent PostgreSQL data storage
- `uploads_data`: File upload storage
- `./logs`: Application logs (mounted from host)

## Health Checks

- **PostgreSQL**: Uses `pg_isready` command
- **API**: HTTP GET request to `/health` endpoint

## Development

For development with live reload, you can override the command:

```bash
docker-compose run --rm -p 3010:3010 app npm run dev
```

## Troubleshooting

1. **Port conflicts**: Change the port mapping in docker-compose.yml if 3010 or 5433 are in use
2. **Database connection issues**: Ensure PostgreSQL is healthy before the API starts
3. **Seeding issues**: Check the `db-init` service logs for seeding errors
4. **Permission issues**: Ensure the logs directory exists and is writable

## Production Considerations

- Change default passwords and secrets
- Use environment-specific configuration files
- Set up proper SSL/TLS certificates
- Configure proper backup strategies for PostgreSQL data
- Monitor container health and logs
