# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# SECURITY NOTE: Environment variables for Vite must be provided at build time
# because Vite bakes them into the static bundle. However, we should NOT use
# Docker ARG for this, as it exposes secrets in image history.
#
# For production deployments:
# 1. Use your CI/CD platform's secret management (GitHub Actions secrets, Cloud Build secrets)
# 2. Set environment variables in the build environment, NOT via Docker ARG
# 3. Example for Cloud Build: use _GEMINI_API_KEY substitution variable
#
# The .env file should be created by your CI/CD pipeline before building:
#   echo "VITE_GEMINI_API_KEY=$GEMINI_API_KEY" > .env
#   echo "VITE_SUPABASE_URL=$SUPABASE_URL" >> .env
#   echo "VITE_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY" >> .env
#
# This keeps secrets out of Docker layer history while still allowing Vite to bundle them.

# Build the application (expects .env to exist with VITE_* variables)
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy the built assets from the build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Cloud Run sets the PORT environment variable
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Nginx alpine image uses envsubst to replace variables in templates
CMD ["nginx", "-g", "daemon off;"]
