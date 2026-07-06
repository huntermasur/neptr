# syntax=docker/dockerfile:1

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
# Use the lockfile for reproducible installs when present, otherwise fall back
# to npm install.
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
{{buildLine}}
EXPOSE {{port}}
CMD {{startCommand}}
