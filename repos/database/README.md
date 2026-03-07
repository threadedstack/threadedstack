# Threaded Stack - Database (@tdsk/database)

The database repo is the ORM layer for the Threaded Stack platform, built on Drizzle ORM with PostgreSQL (Neon.com). It defines 18+ table schemas, a service-based CRUD API, and converts DB records to domain models.


## Purpose & Architecture

### What It Does

The database repo provides:
1. **Drizzle table schemas** for 18+ PostgreSQL tables
2. **Service layer** with CRUD operations (create, get, list, update, upsert, delete)
3. **Singleton database factory** with connection pooling
4. **Type-safe API** using Drizzle's inferred types
5. **Domain model conversion** (DB record → domain model instance)

### 3-Layer Architecture

```
Consumer Repos (backend, proxy)
    ↓ db.services.org.create({...})
Service Layer (src/services/)
    ↓ this.db.insert(this.table).values(data)
Schema Layer (src/schemas/)
    ↓ Drizzle SQL generation
PostgreSQL (Neon.com)
```
