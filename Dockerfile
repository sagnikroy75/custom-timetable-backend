# Builds the server as a small Docker image containing only the finished code.
# It uses three layers (stages):
#   1. deps   - install all the dependencies listed in package-lock.json.
#   2. build  - compile the TypeScript into one single JavaScript bundle.
#   3. runner - make a clean, small image with just the bundle and the runtime.

# Stage 1: install dependencies (node 22, Alpine Linux for a light image).
FROM node:22-alpine AS deps

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: build the bundle.
FROM node:22-alpine AS build

WORKDIR /app
# Reuse the dependencies installed in the previous stage.
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json tsconfig.json ./
COPY server.ts ./
COPY server ./server
# Bundle everything into dist/server.cjs.
RUN npm run build

# Stage 3: the actual runtime image - minimal and clean.
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
# Install only the production dependencies (no dev tools).
RUN npm ci --omit=dev
# Copy in the compiled bundle built earlier.
COPY --from=build /app/dist ./dist
# The container listens on port 3000.
EXPOSE 3000
# Start the server when the container runs.
CMD ["node", "dist/server.cjs"]
