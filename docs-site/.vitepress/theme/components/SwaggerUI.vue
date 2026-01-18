<script setup>
import { onMounted, ref } from 'vue';
import 'swagger-ui-dist/swagger-ui.css';

const props = defineProps({
  specUrl: {
    type: String,
    required: true,
  },
});

onMounted(async () => {
  // Dynamic import to avoid SSR issues
  const SwaggerUIBundle = (await import('swagger-ui-dist/swagger-ui-bundle.js')).default;
  const SwaggerUIStandalonePreset = (
    await import('swagger-ui-dist/swagger-ui-standalone-preset.js')
  ).default;

  SwaggerUIBundle({
    url: props.specUrl,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
    layout: 'StandaloneLayout',
  });
});
</script>

<template>
  <div id="swagger-ui"></div>
</template>

<style>
/* Adjust Swagger UI styles to look decent inside VitePress */
#swagger-ui .swagger-ui .topbar {
  display: none;
}
#swagger-ui .swagger-ui .wrapper {
  padding: 0;
}
</style>
