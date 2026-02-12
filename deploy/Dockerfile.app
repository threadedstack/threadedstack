ARG IMAGE_FROM=node:22-alpine3.19


# ---- Base Stage  ---- #
FROM $IMAGE_FROM AS tdsk-base
RUN npm i -g pnpm
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="${PATH}:${PNPM_HOME}"
RUN npm install --global pnpm@9.15.4
# ---- End Stage ---- #


# ---- PNPM Stage  ---- #
FROM tdsk-base AS tdsk-pnpm
WORKDIR /tdsk
COPY .npmrc pnpm-*.yaml ./
RUN pnpm fetch --ignore-scripts
COPY package.json tsconfig* ./
# ---- End Stage ---- #

# ---- Build Stage  ---- #
FROM tdsk-pnpm AS tdsk-build
WORKDIR /tdsk
ADD repos/logger/package.json ./repos/logger/package.json
ADD repos/domain/package.json ./repos/domain/package.json
ADD repos/database/package.json ./repos/database/package.json
ADD repos/proxy/package.json ./repos/proxy/package.json
ADD repos/backend/package.json ./repos/backend/package.json
ADD repos/agent/package.json ./repos/agent/package.json
RUN pnpm install --frozen-lockfile --prefer-offline

ADD repos/logger ./repos/logger
ADD repos/domain ./repos/domain
ADD repos/database ./repos/database
ADD repos/proxy ./repos/proxy
ADD repos/backend ./repos/backend
ADD repos/agent ./repos/agent
ADD deploy deploy
# ---- End Stage ---- #


# ---- Run Stage  ---- #
FROM tdsk-build AS tdsk-runner
WORKDIR /tdsk
RUN chmod a+x /tdsk/deploy/initialize.sh
ENTRYPOINT [ "/tdsk/deploy/initialize.sh" ]
# ---- End Stage ---- #