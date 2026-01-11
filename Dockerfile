# Build stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Pass environment variables as build arguments
# Note: Vite bakes these into the client-side bundle at build time
ARG GEMINI_API_KEY
ARG SUPABASE_URL
ARG SUPABASE_ANON_KEY

# Set them as environment variables for the build process
ENV GEMINI_API_KEY=$GEMINI_API_KEY
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Build the application
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
