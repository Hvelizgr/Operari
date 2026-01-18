<script setup>
import { useRoute } from 'vitepress'
import { onMounted } from 'vue'

// Basic placeholder for API Reference
// Ideally, use a component like SwaggerUI here or vitepress-plugin-openapi's components if available.
// Since we generated openapi.json, we can link to it or render it.
</script>

# API Reference

NanoFlow provides a RESTful API for managing workflows, executions, and users.

**[Download OpenAPI Specification](/openapi.json)**

## Authentication

All API requests require a Bearer Token.

```http
Authorization: Bearer <your-jwt-token>
```

## Endpoints

For a full interactive documentation, please run the backend locally and visit `http://localhost:4001/api/docs`.

We are working on integrating a static Swagger UI here.
