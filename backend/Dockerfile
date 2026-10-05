# Contexto de build = raíz del repo (el jar empaqueta ../content).
#   docker build -f backend/Dockerfile .
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY content ./content
COPY backend/pom.xml ./backend/pom.xml
RUN mvn -q -B -f backend/pom.xml dependency:go-offline
COPY backend/src ./backend/src
RUN mvn -q -B -f backend/pom.xml -DskipTests package

FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app
USER app
COPY --from=build /src/backend/target/ceti-backend-*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "/app/app.jar"]
