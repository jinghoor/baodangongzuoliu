# 多阶段构建 Dockerfile
# 阶段1: 构建前端
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# 复制前端依赖文件
COPY frontend/package*.json ./

# 安装前端依赖
RUN npm install

# 复制前端源代码
COPY frontend/ ./

# 设置 API 地址为空（使用相对路径，请求同一服务器）
ENV VITE_API_BASE_URL=""

# 构建前端
RUN npm run build

# 阶段2: 构建后端
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# 复制后端依赖文件
COPY backend/package*.json ./

# 安装后端依赖
RUN npm install

# 复制后端源代码
COPY backend/ ./

# 构建后端
RUN npm run build

# 阶段3: 生产环境镜像
FROM node:20-alpine

WORKDIR /app

# 复制后端 package.json 到 backend 目录
COPY backend/package*.json ./backend/

# 在 backend 目录安装生产依赖
WORKDIR /app/backend
RUN npm install --omit=dev

# 复制构建后的后端代码
COPY --from=backend-builder /app/backend/dist ./dist

# 复制构建后的前端代码到正确位置
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# 创建数据目录
RUN mkdir -p /app/backend/data /app/backend/uploads

# 暴露端口
EXPOSE 3000

# 工作目录保持在 backend
WORKDIR /app/backend

# 启动应用
CMD ["node", "dist/index.js"]
