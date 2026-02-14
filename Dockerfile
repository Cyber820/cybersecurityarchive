# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# ===== 先复制 package.json（利用缓存层，加快构建）=====
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# ===== 安装依赖（根 workspace）=====
RUN npm install

# ===== 再复制全部源码 =====
COPY . .

# ===== 构建前端 dist =====
RUN npm run build

# ===== 断言：必须产出 dist（否则直接失败，避免运行时才报 Static dist missing）=====
RUN test -f apps/web/dist/index.html
RUN test -f apps/web/dist/admin.html

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/api/src/server.js"]
