# Worker Pool Architecture for Scaling

> Reference document for scaling the signal copier to 1000+ users with VIP private channels.

## When to Implement

- **Current architecture works for**: ~500-1000 users on a single server
- **Implement worker pools when**: You hit ~500 users OR server RAM exceeds 80%
- **Signs you need this**: Telegram connections dropping, slow response times, high memory usage

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         LOAD BALANCER                           │
│                    (Railway/Render/K8s Ingress)                 │
└─────────────────────────────────────────────────────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ↓            ↓            ↓
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Worker 1 │ │ Worker 2 │ │ Worker N │
              │ Users    │ │ Users    │ │ Users    │
              │ A-F      │ │ G-M      │ │ N-Z      │
              └────┬─────┘ └────┬─────┘ └────┬─────┘
                   │            │            │
                   └────────────┼────────────┘
                                ↓
                    ┌───────────────────────┐
                    │   Shared Services     │
                    │  - Supabase (DB)      │
                    │  - Redis (optional)   │
                    │  - Anthropic API      │
                    │  - MetaAPI            │
                    └───────────────────────┘
```

---

## Database Changes Required

### 1. Add worker assignment to profiles table

```sql
ALTER TABLE profiles ADD COLUMN worker_id TEXT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN worker_assigned_at TIMESTAMP DEFAULT NULL;

-- Index for fast worker queries
CREATE INDEX idx_profiles_worker_id ON profiles(worker_id);
```

### 2. Worker registry table (optional but recommended)

```sql
CREATE TABLE workers (
    id TEXT PRIMARY KEY,
    hostname TEXT NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    last_heartbeat TIMESTAMP DEFAULT NOW(),
    user_count INTEGER DEFAULT 0,
    max_users INTEGER DEFAULT 500,
    status TEXT DEFAULT 'active', -- active, draining, offline
    region TEXT DEFAULT 'us-east'
);
```

---

## Code Changes Required

### 1. New environment variables

```bash
# Each worker gets a unique ID
WORKER_ID=worker-1
WORKER_MAX_USERS=500

# Optional: Redis for coordination
REDIS_URL=redis://...
```

### 2. Modified startup in main.py

```python
async def run_multi_tenant():
    """Run worker with assigned users only."""
    worker_id = os.getenv("WORKER_ID", "worker-1")
    max_users = int(os.getenv("WORKER_MAX_USERS", "500"))

    log.info(f"Starting worker {worker_id} (max {max_users} users)")

    # Register this worker
    await register_worker(worker_id, max_users)

    # Start heartbeat task
    asyncio.create_task(worker_heartbeat(worker_id))

    # Only load users assigned to THIS worker
    supabase = get_supabase_admin()
    result = supabase.table("profiles") \
        .select("id,email") \
        .eq("status", "active") \
        .eq("worker_id", worker_id) \
        .execute()

    # Connect only our users
    for profile in result.data:
        await user_manager.connect_user(profile["id"])

    # Watch for new user assignments
    asyncio.create_task(watch_for_new_users(worker_id))
```

### 3. User assignment logic (new file: src/workers/assignment.py)

```python
"""Worker assignment logic."""
from ..database.supabase import get_supabase_admin

async def assign_user_to_worker(user_id: str) -> str:
    """Assign a new user to the least-loaded worker.

    Called when:
    - New user completes onboarding
    - User clicks "connect" in settings

    Returns:
        worker_id the user was assigned to
    """
    supabase = get_supabase_admin()

    # Find worker with capacity
    workers = supabase.table("workers") \
        .select("*") \
        .eq("status", "active") \
        .lt("user_count", "max_users") \
        .order("user_count", desc=False) \
        .limit(1) \
        .execute()

    if not workers.data:
        raise Exception("No workers available with capacity")

    worker = workers.data[0]
    worker_id = worker["id"]

    # Assign user to worker
    supabase.table("profiles") \
        .update({
            "worker_id": worker_id,
            "worker_assigned_at": datetime.utcnow().isoformat()
        }) \
        .eq("id", user_id) \
        .execute()

    # Increment worker user count
    supabase.table("workers") \
        .update({"user_count": worker["user_count"] + 1}) \
        .eq("id", worker_id) \
        .execute()

    return worker_id

async def get_user_worker(user_id: str) -> Optional[str]:
    """Get the worker a user is assigned to."""
    supabase = get_supabase_admin()
    result = supabase.table("profiles") \
        .select("worker_id") \
        .eq("id", user_id) \
        .single() \
        .execute()
    return result.data.get("worker_id") if result.data else None
```

### 4. Worker heartbeat (new file: src/workers/heartbeat.py)

```python
"""Worker health monitoring."""
import asyncio
from datetime import datetime
from ..database.supabase import get_supabase_admin
from ..utils.logger import log

async def register_worker(worker_id: str, max_users: int):
    """Register this worker on startup."""
    supabase = get_supabase_admin()

    supabase.table("workers").upsert({
        "id": worker_id,
        "hostname": os.getenv("HOSTNAME", "unknown"),
        "started_at": datetime.utcnow().isoformat(),
        "last_heartbeat": datetime.utcnow().isoformat(),
        "max_users": max_users,
        "status": "active",
    }).execute()

    log.info(f"Worker {worker_id} registered")

async def worker_heartbeat(worker_id: str):
    """Send periodic heartbeat to mark worker as alive."""
    supabase = get_supabase_admin()

    while True:
        try:
            # Update heartbeat
            supabase.table("workers") \
                .update({
                    "last_heartbeat": datetime.utcnow().isoformat(),
                    "user_count": user_manager.active_users,
                }) \
                .eq("id", worker_id) \
                .execute()

        except Exception as e:
            log.error(f"Heartbeat failed: {e}")

        await asyncio.sleep(30)  # Every 30 seconds

async def watch_for_new_users(worker_id: str):
    """Watch for newly assigned users and connect them."""
    supabase = get_supabase_admin()
    known_users = set(user_manager.get_all_active_users())

    while True:
        try:
            # Query users assigned to this worker
            result = supabase.table("profiles") \
                .select("id") \
                .eq("status", "active") \
                .eq("worker_id", worker_id) \
                .execute()

            current_users = {u["id"] for u in result.data}

            # Find new users
            new_users = current_users - known_users
            for user_id in new_users:
                log.info(f"New user assigned: {user_id[:8]}")
                await user_manager.connect_user(user_id)

            # Find removed users
            removed_users = known_users - current_users
            for user_id in removed_users:
                log.info(f"User unassigned: {user_id[:8]}")
                await user_manager.disconnect_user(user_id)

            known_users = current_users

        except Exception as e:
            log.error(f"User watch failed: {e}")

        await asyncio.sleep(10)  # Check every 10 seconds
```

---

## Deployment Options

### Option A: Railway (Easiest)

```yaml
# railway.toml
[deploy]
numReplicas = 5  # 5 workers

[env]
WORKER_MAX_USERS = "500"
# WORKER_ID is auto-generated per replica
```

Each Railway replica gets a unique instance ID you can use as WORKER_ID.

### Option B: Docker Compose (Self-hosted)

```yaml
# docker-compose.yml
version: '3.8'

services:
  worker-1:
    build: .
    environment:
      - WORKER_ID=worker-1
      - WORKER_MAX_USERS=500
      - MULTI_TENANT_MODE=true

  worker-2:
    build: .
    environment:
      - WORKER_ID=worker-2
      - WORKER_MAX_USERS=500
      - MULTI_TENANT_MODE=true

  worker-3:
    build: .
    environment:
      - WORKER_ID=worker-3
      - WORKER_MAX_USERS=500
      - MULTI_TENANT_MODE=true

  # API gateway (handles HTTP requests, routes to workers)
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - API_ONLY=true  # Only run API, no Telegram listeners
```

### Option C: Kubernetes (Production scale)

```yaml
# k8s/worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: signal-workers
spec:
  replicas: 10  # Start with 10 workers
  selector:
    matchLabels:
      app: signal-worker
  template:
    metadata:
      labels:
        app: signal-worker
    spec:
      containers:
      - name: worker
        image: your-registry/signal-copier:latest
        env:
        - name: WORKER_ID
          valueFrom:
            fieldRef:
              fieldPath: metadata.name  # Uses pod name as worker ID
        - name: WORKER_MAX_USERS
          value: "500"
        - name: MULTI_TENANT_MODE
          value: "true"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: signal-workers-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: signal-workers
  minReplicas: 5
  maxReplicas: 100
  metrics:
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70
```

---

## API Changes for Multi-Worker

### Route requests to correct worker

When a user calls `/system/connect-me`, the API needs to:

1. Check if user is already assigned to a worker
2. If not, assign to least-loaded worker
3. Notify that worker to connect the user (via Redis pub/sub or DB polling)

```python
# In routes.py - updated connect-me endpoint

@router.post("/system/connect-me")
async def connect_current_user(user: AuthUser = Depends(get_current_user)):
    from ..workers.assignment import assign_user_to_worker, get_user_worker

    # Check current assignment
    current_worker = await get_user_worker(user.id)

    if not current_worker:
        # Assign to a worker
        current_worker = await assign_user_to_worker(user.id)
        log.info(f"User {user.id[:8]} assigned to {current_worker}")

    # The worker will pick up the user via watch_for_new_users()
    # Just return success - actual connection happens async
    return {
        "status": "connecting",
        "worker": current_worker,
        "message": "Connection initiated, please wait..."
    }
```

---

## Monitoring & Observability

### Key metrics to track

```python
# Add to each worker
from prometheus_client import Gauge, Counter

# Metrics
users_connected = Gauge('users_connected', 'Number of connected users', ['worker_id'])
telegram_connections = Gauge('telegram_connections', 'Active Telegram connections', ['worker_id'])
signals_processed = Counter('signals_processed', 'Total signals processed', ['worker_id'])
connection_errors = Counter('connection_errors', 'Connection errors', ['worker_id', 'type'])
```

### Health check endpoint

```python
@router.get("/health")
async def health_check():
    worker_id = os.getenv("WORKER_ID", "unknown")
    return {
        "worker_id": worker_id,
        "status": "healthy",
        "users_connected": user_manager.active_users,
        "telegram_connections": user_manager.connected_users,
        "uptime_seconds": (datetime.utcnow() - start_time).total_seconds(),
    }
```

---

## Migration Plan

### Step 1: Prepare (do this before you need it)
- [ ] Add `worker_id` column to profiles table
- [ ] Create workers table
- [ ] Test worker assignment logic locally

### Step 2: Deploy first worker
- [ ] Deploy current code as "worker-1"
- [ ] All existing users auto-assigned to worker-1
- [ ] Verify everything works

### Step 3: Add workers as needed
- [ ] When worker-1 hits 400 users, deploy worker-2
- [ ] New users auto-assigned to worker-2
- [ ] Monitor both workers

### Step 4: Automate
- [ ] Set up auto-scaling (K8s HPA or similar)
- [ ] Add monitoring/alerting
- [ ] Document runbooks for common issues

---

## Cost Estimates

| Users | Workers | RAM Total | Monthly Cost (est.) |
|-------|---------|-----------|---------------------|
| 500 | 1 | 2 GB | $20-50 |
| 2,500 | 5 | 10 GB | $100-250 |
| 10,000 | 20 | 40 GB | $400-1,000 |
| 50,000 | 100 | 200 GB | $2,000-5,000 |
| 100,000 | 200 | 400 GB | $4,000-10,000 |

**Note**: These are rough estimates. Actual costs depend on provider and region.

---

## FAQ

**Q: What happens if a worker crashes?**
A: Users assigned to that worker lose connection. On restart, the worker reconnects all its users. Consider implementing worker failover for high availability.

**Q: Can I move a user between workers?**
A: Yes - update their `worker_id` in the database. The old worker will disconnect them (via watch loop), and the new worker will connect them.

**Q: What about the API/dashboard?**
A: Run a separate API-only instance that handles HTTP requests. It doesn't need Telegram connections, just database access.

**Q: Do I need Redis?**
A: Not required but helpful for real-time coordination between workers. Without Redis, workers poll the database every 10 seconds for changes.

---

## Summary

1. **Don't implement until you have ~500 users**
2. **Start simple**: Just add worker_id to database, deploy second instance
3. **Scale gradually**: Add workers as needed, don't over-engineer
4. **Monitor**: Track memory, connections, and errors per worker
5. **Cost scales linearly**: More users = more workers = more cost (but also more revenue)

The current single-server setup handles your growth for now. Revisit this document when you're ready to scale.
