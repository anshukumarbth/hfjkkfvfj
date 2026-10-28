# ==============================================================================
# UK Wind Forecast Analysis - Frontend Dockerfile
# Multi-stage production build: Node.js 20 builder -> Alpine Nginx web server
# ==============================================================================

# Stage 1: Build React SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies using clean install
COPY package.json package-lock.json ./
RUN npm ci

# Inject build argument for backend API URL into Vite build bundle
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Copy frontend source code
COPY . .

# Compile TypeScript and bundle production assets
RUN npm run build

# Stage 2: Production Web Server
FROM nginx:1.27-alpine AS runner

# Remove default Nginx welcome site
RUN rm -rf /usr/share/nginx/html/*

# Copy built artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Health check using the /healthz endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/healthz || exit 1

# Start Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
