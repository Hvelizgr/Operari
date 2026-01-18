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

## Interactive Documentation

<ClientOnly>
  <SwaggerUI specUrl="/openapi.json" />
</ClientOnly>
