# ==== STAGE 1: BUILD ====
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN yarn build

# ==== STAGE 2: PRODUCTION ====
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app

# Set node environment
ENV NODE_ENV production

# Add a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy only necessary files from builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./
# Create uploads directory and set permissions
RUN mkdir -p uploads && \
    chown -R nestjs:nodejs uploads && \
    chmod 755 uploads

# Expose ports
EXPOSE 3000
EXPOSE 3001
EXPOSE 3002

# Switch to non-root user
USER nestjs

# Command to run the app
CMD ["node", "dist/main.js"]