
export const earthVertexShader = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vUv = uv;
  // World Space Normal (assuming uniform scale)
  // modelMatrix transforms local to world
  vNormal = normalize(mat3(modelMatrix) * normal);
  
  // World Position
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vPosition = worldPosition.xyz;
  
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

export const earthFragmentShader = `
uniform sampler2D dayTexture;
uniform sampler2D nightTexture;
uniform sampler2D specularMap;
uniform vec3 sunDirection;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  // Lighting calculation in World Space
  // sunDirection is World Space vector (normalized)
  float dotProd = dot(vNormal, normalize(sunDirection));
  
  // mixVal: 1 = Day, 0 = Night
  // Smooth transition around terminator
  float mixVal = smoothstep(-0.15, 0.15, dotProd);
  
  vec3 dayColor = texture2D(dayTexture, vUv).rgb;
  vec3 nightColor = texture2D(nightTexture, vUv).rgb;
  vec3 specMapColor = texture2D(specularMap, vUv).rgb;
  
  // Mix day and night
  vec3 finalColor = mix(nightColor, dayColor, mixVal);
  
  // Boost Night Lights on dark side only
  // If it is night (mixVal approx 0), we want the night texture to pop
  // Standard mixing might make it dull if nightTexture is dark.
  // Actually nightTexture IS lights on black.
  // So mix(lights, day, 0) = lights. This is correct.
  
  // Add Specular (only on day side)
  // Simple view-dependent specular optional, or just boost day brilliance
  
  // Enhance night lights "bloom" feel
  if (dotProd < 0.0) {
      finalColor += nightColor * 0.8 * (1.0 - mixVal); 
  }

  // Debug: Show normal
  // gl_FragColor = vec4(vNormal * 0.5 + 0.5, 1.0);
  
  gl_FragColor = vec4(finalColor, 1.0);
}
`;
