FROM node:22-bookworm-slim AS frontend
WORKDIR /build
RUN npm install -g pnpm@10.34.5
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN pnpm build

FROM python:3.13-slim
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
COPY schema.sql /app/schema.sql
COPY --from=frontend /build/dist /app/frontend/dist
EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn lifetrace.app:app --host 0.0.0.0 --port 8000"]
