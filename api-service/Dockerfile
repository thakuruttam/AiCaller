FROM node:20-alpine
WORKDIR /app

# Copy prisma schema before npm install so postinstall can generate client
COPY package*.json ./
COPY prisma.config.js ./
COPY prisma ./prisma/
RUN npm ci --production && npx prisma generate

COPY src ./src

EXPOSE 3000
CMD ["node", "src/server.js"]
