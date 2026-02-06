FROM node:20

# AWS CLI é necessário para o api-server (spawn de comandos aws)
# Credenciais via env vars no docker-compose (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
RUN apt-get update && \
    apt-get install -y --no-install-recommends unzip curl ca-certificates && \
    curl -sSf "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && \
    unzip -q awscliv2.zip && \
    ./aws/install && \
    rm -rf aws awscliv2.zip && \
    apt-get remove -y unzip && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Diretório de trabalho dentro do container
WORKDIR /app

# Copiar manifests antes para aproveitar o cache
COPY package.json package-lock.json* ./

# Instalar dependências NPM
RUN npm install

# Copiar o restante do projeto
COPY . .

# Portas expostas: Vite (3005) + API Express (3006)
EXPOSE 3005 3006

CMD ["npm", "run", "dev"]
