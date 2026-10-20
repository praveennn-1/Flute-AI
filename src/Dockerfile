# Stage 1: Build the Vite React application
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for Docker layer caching
COPY package*.json ./
RUN npm install

# Copy source code and configuration
COPY . .

# Build the production bundle into /app/dist
RUN npm run build

# Stage 2: Serve static assets with lightweight Nginx
FROM nginx:alpine

# Clean default Nginx web root and configuration
RUN rm -rf /etc/nginx/conf.d/* /usr/share/nginx/html/*

# Copy custom Nginx configuration optimized for SPA and Render
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy production build artifacts from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Render routes to port 10000 by default (also expose 80)
EXPOSE 80 10000

# Run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]

