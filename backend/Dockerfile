
FROM eclipse-temurin:21-jdk

WORKDIR /app

# Install Python and Git for the security scanner
RUN apt-get update && apt-get install -y --no-install-recommends python3 git \
    && rm -rf /var/lib/apt/lists/*

# Copy Maven files
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY mvnw.cmd ./
COPY src ./src

# Copy the ActionGuard Python scanner
COPY ActionGaurd/actionguard ./ActionGaurd/actionguard

# Configure scanner paths inside Docker
ENV ACTIONGUARD_SCANNER_DIR=/app/ActionGaurd
ENV ACTIONGUARD_PYTHON=python3

RUN chmod +x mvnw
RUN ./mvnw -B clean package -DskipTests

EXPOSE 8081

CMD ["java", "-jar", "target/backend-0.0.1-SNAPSHOT.jar"]
