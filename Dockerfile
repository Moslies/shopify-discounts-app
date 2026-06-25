FROM node:20-alpine
RUN apk add --no-cache openssl

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# 关键修正：复制 schema 并强制生成 Client
COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

EXPOSE 3000
# 启动时依然保留这个组合命令，确保万无一失
CMD ["sh", "-c", "npx prisma migrate deploy && npx react-router-serve ./build/server/index.js --host 0.0.0.0 --port 3000"]