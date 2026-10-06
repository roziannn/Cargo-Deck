# Gunakan node 22 sesuai versi lokal Anda
FROM node:22-alpine

# Install pnpm secara global
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy file package dan lock file pnpm
COPY package.json pnpm-lock.yaml* ./

# Install dependencies menggunakan pnpm
RUN pnpm install

# Copy semua file project
COPY . .

EXPOSE 3000

# Jalankan perintah dev pnpm
CMD ["pnpm", "run", "dev"]