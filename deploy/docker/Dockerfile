# bertha in a container: the release binary on Alpine, checked against its checksum.
#
#   docker build --build-arg BERTHA_VERSION=v0.1.2 -t bertha .
#
# compose.yaml in this folder builds it for you. The image runs as an unprivileged
# user, keeps its database in /data, and listens on port 3000.

FROM alpine:3.22 AS download
ARG BERTHA_VERSION
ARG TARGETARCH
RUN test -n "$BERTHA_VERSION" || { echo "Set BERTHA_VERSION, e.g. v0.1.2"; exit 1; }
WORKDIR /dl
RUN case "$TARGETARCH" in \
      amd64) target=x86_64-unknown-linux-musl ;; \
      arm64) target=aarch64-unknown-linux-musl ;; \
      *) echo "No release build for $TARGETARCH"; exit 1 ;; \
    esac \
 && base="https://github.com/felixowens/bertha/releases/download/$BERTHA_VERSION" \
 && wget -q "$base/bertha-$target.tar.gz" "$base/bertha-$target.tar.gz.sha256" \
 && sha256sum -c "bertha-$target.tar.gz.sha256" \
 && tar -xzf "bertha-$target.tar.gz" \
 && ./bertha --version

FROM alpine:3.22
# CA roots for SMTP, webhooks and uptime checks over TLS; tzdata for local times in logs.
RUN apk add --no-cache ca-certificates tzdata \
 && adduser -D -H -u 10001 -s /sbin/nologin bertha \
 && install -d -o bertha -g bertha -m 0750 /data
COPY --from=download /dl/bertha /usr/local/bin/bertha
USER bertha
WORKDIR /data
ENV DATABASE_PATH=/data/bertha.db \
    BERTHA_BIND=0.0.0.0:3000 \
    BERTHA_LOG_FORMAT=json
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:3000/healthz >/dev/null || exit 1
ENTRYPOINT ["bertha"]
CMD ["serve"]
