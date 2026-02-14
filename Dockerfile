# syntax=docker/dockerfile:1
FROM node:22-alpine

WORKDIR /app

# 先复制整个项目
COPY . .

# ===== 安装 web 依赖并构建 =====
WORKDIR /app/apps/web
RUN npm install
RUN npm run build

# ===== 安装 api 依赖（如果存在 package.json）=====
WORKDIR /app/apps/api
RUN if [ -f package.json ]; then npm install; fi

# ===== 启动服务 =====
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "apps/api/src/server.js"]
