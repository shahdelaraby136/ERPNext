# Docker Build Setup

These files configure the `custom-erpnext:latest` image used by `frappe_docker`'s `custom-pwd.yml` compose stack.

## Files
- **`apps.json`** — list of apps baked into the image at build time. Edit to add/remove apps for the next image rebuild.
- **`Containerfile.raven-add`** — derives a new image FROM `custom-erpnext:latest` and adds Raven (gcc + `bench get-app` + Python deps + yarn). Used because Raven's `blurhash-python` dep needs gcc which the runtime image strips.

## Usage

### Add Raven to an existing image
```bash
cd ~/Desktop/erpnext-docker/frappe_docker
docker build -t custom-erpnext:with-raven \
    -f images/custom/Containerfile.raven-add .

# After the running container has raven working, snapshot it:
docker export erpnext-custom-backend-1 -o /tmp/snapshot.tar
docker import \
    --change 'WORKDIR /home/frappe/frappe-bench' \
    --change 'USER frappe' \
    --change 'ENV NVM_DIR=/home/frappe/.nvm' \
    --change 'CMD ["bench","start"]' \
    /tmp/snapshot.tar custom-erpnext:latest
rm /tmp/snapshot.tar
```

### Full image rebuild (slow, 30-60 min)
```bash
cd ~/Desktop/erpnext-docker/frappe_docker
cp /path/to/this/repo/docker/apps.json apps.json
docker build \
    --no-cache-filter=builder \
    --secret id=apps_json,src=apps.json \
    --build-arg PYTHON_VERSION=3.14.2 \
    --build-arg NODE_VERSION=24.13.0 \
    --build-arg FRAPPE_BRANCH=version-16 \
    -t custom-erpnext:latest \
    -f images/custom/Containerfile .
```

## Why two flows?
- `bench build`'s default flow re-clones every app and re-runs `yarn install` for the whole bench. For a single new app this wastes ~30 min.
- The `Containerfile.raven-add` skips that and only installs the new app on top.
