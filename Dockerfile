FROM node:20-slim

# Install nginx and openssl (required for Prisma), then clean up
RUN apt-get update && apt-get install -y nginx openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pm2

WORKDIR /app

# Copy the entire mono-repo
COPY . .

# Setup api-service
RUN cd api-service && npm install --production && npx prisma generate

# Setup telephony-gateway
RUN cd telephony-gateway && npm install --production && npx prisma generate

# Setup call-worker
RUN cd call-worker && npm install --production && npx prisma generate

# Setup call-evaluation-service
RUN cd call-evaluation-service && npm install --production && npx prisma generate

# Replace default nginx config with our monolith config
COPY nginx-monolith.conf /etc/nginx/nginx.conf

# Start Nginx and PM2 (which runs all 5 Node processes)
EXPOSE 8080
CMD service nginx start && pm2-runtime start ecosystem.config.js
