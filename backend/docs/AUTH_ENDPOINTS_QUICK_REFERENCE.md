# Authentication Endpoints Quick Reference

## Endpoints

### 1. Register User
**POST** `/api/auth/register`

**Request:**
```json
{
  "username": "testuser",
  "password": "password123",
  "role": "viewer"
}
```

**Success Response (201):**
```json
{
  "id": 1,
  "username": "testuser",
  "role": "viewer",
  "createdAt": "2024-01-01T12:00:00.000Z"
}
```

**Error Responses:**
- `400` - Validation error
- `409` - Username already exists
- `500` - Server error

---

### 2. Login
**POST** `/api/auth/login`

**Request:**
```json
{
  "username": "testuser",
  "password": "password123"
}
```

**Success Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2024-01-02T12:00:00.000Z",
  "user": {
    "id": 1,
    "username": "testuser",
    "role": "viewer"
  }
}
```

**Error Responses:**
- `400` - Validation error
- `401` - Invalid credentials
- `500` - Server error

---

## Validation Rules

### Register
- **username**: 3-50 characters, required
- **password**: 8-100 characters, required
- **role**: "admin" or "viewer", required

### Login
- **username**: required
- **password**: required

---

## Testing with curl

### Register
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123","role":"viewer"}'
```

### Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

### Use Token
```bash
# Save token from login response
TOKEN="your-jwt-token-here"

# Use token in subsequent requests
curl -X GET http://localhost:8080/api/screenings \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Examples

### Validation Error (400)
```json
{
  "error": "Validation failed",
  "detail": "Invalid request body",
  "fields": {
    "username": "Username must be at least 3 characters long",
    "password": "Password is required"
  }
}
```

### Duplicate Username (409)
```json
{
  "error": "Conflict",
  "detail": "Username already exists"
}
```

### Invalid Credentials (401)
```json
{
  "error": "Unauthorized",
  "detail": "Invalid credentials"
}
```

---

## Security Notes

1. **Password Security**: Passwords are hashed with bcrypt (12 rounds)
2. **Token Expiration**: JWT tokens expire after 24 hours
3. **Credential Masking**: Login errors don't reveal if username or password was wrong
4. **HTTPS Required**: Use HTTPS in production to protect credentials in transit
