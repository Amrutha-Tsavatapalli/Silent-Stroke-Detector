# Legacy API Mapping Guide

This document maps the deprecated Python FastAPI endpoints to their new Node.js server equivalents for the ML Pipeline Migration project.

## 1. Overview

The backend has been migrated from Python FastAPI (port 8000) to a Node.js Express server (port 3001) with a Progressive Web Application (PWA) frontend (port 5173). The new architecture separates concerns:

- **Node.js Server** (`server/`): Handles API routes, database operations, and business logic
- **PWA Client** (`client/`): Provides the user interface for conducting stroke screenings

## 2. Endpoint Mapping Table

| Old Endpoint (Python FastAPI) | New Endpoint (Node.js) | Notes |
|-------------------------------|------------------------|-------|
| `POST /analyze` | `POST /api/sessions` + PWA screens | Analysis now happens via multi-step PWA flow |
| `GET /health` | Not needed | PWA handles connectivity; server returns 200 if running |
| `POST /screenings` | `POST /api/sessions` | Creates new screening session |
| `GET /screenings` | `GET /api/sessions/:id` | Retrieves screening by session ID |
| `POST /alert-events` | `POST /api/feedback` | Submit feedback or alert events |

### Detailed Endpoint Changes

#### POST /api/sessions
- **Purpose**: Create a new screening session
- **Request Body**: `{ district, risk_level, frame_logs, raw_speech_scores }`
- **Response**: `{ id, status, created_at }`

#### GET /api/sessions/:id
- **Purpose**: Retrieve session details
- **Response**: Session object with all related data

#### POST /api/feedback
- **Purpose**: Submit feedback or alert events
- **Request Body**: `{ session_id, feedback_type, message }`

## 3. Field Mappings

| Old Field | New Field | Notes |
|-----------|-----------|-------|
| `patient_name` | *(removed)* | **Deprecated for privacy** - no longer collected |
| `location` | `district` | Renamed for clarity |
| `risk_score` | `risk_score` | Unchanged |
| `decision` | `risk_level` | Renamed; values changed (see below) |
| `face_payload` | *(moved)* | Now stored in `frame_logs` array |
| `voice_payload` | *(moved)* | Now stored in `raw_speech_scores` object |

### Risk Level Values

The `decision` field has been renamed to `risk_level` with updated values:

| Old Value | New Value | Meaning |
|-----------|-----------|---------|
| `clear` | `CLEAR` | No stroke indicators detected |
| `warn` | `WARN` | Some indicators present, monitor closely |
| `flag` | `FLAG` | High risk, immediate attention required |

### Data Structure Changes

**Frame Logs** (formerly `face_payload`):
```json
{
  "frame_logs": [
    { "timestamp": 1234567890, "asymmetry_score": 0.15, "frame_data": "..." }
  ]
}
```

**Speech Scores** (formerly `voice_payload`):
```json
{
  "raw_speech_scores": {
    "slur_score": 0.3,
    "clarity_score": 0.85,
    "word_error_rate": 0.05
  }
}
```

## 4. Migration Checklist

External consumers of the legacy API should complete the following steps:

### Immediate Actions
- [ ] Update API base URL from `http://localhost:8000` to `http://localhost:3001`
- [ ] Remove `patient_name` field from all requests (no longer accepted)

### Request Updates
- [ ] Rename `location` to `district` in request bodies
- [ ] Rename `decision` to `risk_level` in responses
- [ ] Update risk level values to `CLEAR`, `WARN`, `FLAG` (uppercase)

### Data Structure Updates
- [ ] Move `face_payload` content to `frame_logs` array
- [ ] Move `voice_payload` content to `raw_speech_scores` object

### UI Updates
- [ ] Point UI to new PWA at `http://localhost:5173` for manual screenings
- [ ] Update any hardcoded port references

### Testing
- [ ] Verify new endpoints return expected response format
- [ ] Confirm risk level values are correctly interpreted
- [ ] Test error handling for missing fields

## 5. Deprecation Timeline

| Date | Milestone |
|------|-----------|
| October 30, 2026 | Legacy Python FastAPI server fully deprecated |
| Post-deprecation | All requests to port 8000 will return 410 Gone |

### Migration Support

For assistance with migration, please refer to:
- New API documentation in `server/src/routes/`
- PWA source code in `client/src/`
- Database schema in `server/prisma/schema.sql`

---

*Last updated: Migration completion date*