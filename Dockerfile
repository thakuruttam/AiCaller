FROM node:20-alpine

# Install nginx and pm2
RUN apk add --no-cache nginx
RUN npm install -g pm2

WORKDIR /app

# Copy the entire mono-repo
COPY . .

# Setup api-service
RUN cd api-service && npm ci --production && npx prisma generate

# Setup telephony-gateway
RUN cd telephony-gateway && npm ci --production && npx prisma generate

# Setup call-worker
RUN cd call-worker && npm ci --production

# Setup call-evaluation-service
RUN cd call-evaluation-service && npm ci --production && npx prisma generate

# Replace default nginx config with our monolith config
COPY nginx-monolith.conf /etc/nginx/nginx.conf

# Start Nginx and PM2 (which runs all 5 Node processes)
EXPOSE 8080
CMD nginx && pm2-runtime start ecosystem.config.js
