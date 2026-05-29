# Kubernetes (kind / minikube)

Deploy the full stack to a local self-hosted cluster. Same topology as Docker Compose:
Postgres (StatefulSet + PVC), Redis, a migration Job (Helm hook), the ingestion API + worker,
and the web app.

## Prerequisites

- [kind](https://kind.sigs.k8s.io/) or minikube, `kubectl`, and `helm`.

## Deploy

```bash
# 1. Build the two runtime images (the Dockerfile's targets).
docker build --target web        -t ollive-web:latest .
docker build --target ingestion  -t ollive-ingestion:latest .

# 2. Create a cluster and load the images into it (kind doesn't pull from a registry).
kind create cluster --name ollive
kind load docker-image ollive-web:latest ollive-ingestion:latest --name ollive

# 3. Install the chart (pass your OpenRouter key).
helm install ollive ./infra/k8s/helm --set openrouterApiKey=sk-or-...

# 4. Wait for rollout, then port-forward the web app.
kubectl rollout status deploy/ollive-web
kubectl port-forward svc/ollive-web 3000:3000
# → http://localhost:3000/chat  and  /dashboard
```

minikube is the same, but load images with `minikube image load ollive-web:latest ollive-ingestion:latest`.

## Notes

- The `ollive-migrate` Job runs on every `helm install`/`upgrade` (post-install hook) and applies
  Drizzle migrations before the app rolls out.
- `imagePullPolicy: IfNotPresent` so the cluster uses the loaded local images.
- This is a local self-hosted target. For a real cluster: push images to a registry, move the DB
  password into a Secret (it's in the ConfigMap here for local convenience), and add an Ingress.
