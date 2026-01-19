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

# 安装生产依赖
COPY backend/package*.json ./
RUN npm install --omit=dev

# 复制构建后的后端代码
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package.json ./backend/

# 复制构建后的前端代码
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 创建数据目录
RUN mkdir -p data uploads

# 暴露端口
EXPOSE 3000

# 设置工作目录为后端目录
WORKDIR /app/backend

# 启动应用
CMD ["node", "dist/index.js"]
