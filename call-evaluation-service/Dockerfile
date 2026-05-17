FROM node:20-slim

# Install OpenSSL for Prisma's query engine (Debian/Ubuntu-based images require it)
RUN apt-get update -y && apt-get install -y openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Generate Prisma client for production
RUN npx prisma generate

EXPOSE 4000

# Default command starts the API server.
# For workers, override command in docker-compose.yml
CMD ["node", "src/server.js"]
