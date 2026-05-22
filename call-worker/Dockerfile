FROM node:20-alpine
WORKDIR /app

# Copy prisma schema before npm install so postinstall can generate client
COPY package*.json ./
COPY prisma.config.js ./
COPY prisma ./prisma/
RUN npm install --production && npx prisma generate

COPY src ./src

CMD ["node", "src/index.js"]
