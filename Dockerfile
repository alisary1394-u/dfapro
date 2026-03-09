# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

# Install a simple static server
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist /app/dist

WORKDIR /app

# Default port for Railway if PORT is not injected
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start the static server
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
