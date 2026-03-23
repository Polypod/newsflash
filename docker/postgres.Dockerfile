FROM pgvector/pgvector:pg15

RUN apt-get update && \
    apt-get install -y postgresql-15-postgis-3 postgresql-15-postgis-3-scripts && \
    rm -rf /var/lib/apt/lists/*
