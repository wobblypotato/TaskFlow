(function () {
  'use strict';

  function initAmbientShader() {
    // Strictly disable ambient canvas on dashboard/workspace
    if (window.location.pathname.includes('dashboard.html') || document.querySelector('.app-layout') || document.querySelector('.app-shell')) {
      const existing = document.getElementById('tf-ambient-container') || document.querySelector('.ambient-background-layer');
      if (existing) existing.remove();
      return;
    }

    let canvas = document.getElementById('ambient-canvas') || document.getElementById('tf-ambient-canvas');
    let container = document.getElementById('tf-ambient-container') || document.querySelector('.ambient-background-layer');

    if (!container) {
      container = document.createElement('div');
      container.id = 'tf-ambient-container';
      container.className = 'ambient-background-layer';
      container.setAttribute('aria-hidden', 'true');
      document.body.prepend(container);
    }

    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'tf-ambient-canvas';
      canvas.className = 'ambient-canvas';
      container.appendChild(canvas);
    }

    // Check prefers-reduced-motion
    let isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Determine intensity: subtle slate aura on workspace, balanced on landing & auth
    const isDashboard = window.location.pathname.includes('dashboard.html');
    const targetIntensity = isDashboard ? 0.26 : 0.65;

    // Try WebGL first
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { powerPreference: 'low-power', alpha: false, antialias: false }) ||
           canvas.getContext('experimental-webgl', { powerPreference: 'low-power', alpha: false, antialias: false });
    } catch (e) {
      gl = null;
    }

    if (!gl) {
      // 2D Canvas Fallback
      init2DFallback(canvas, container, isReducedMotion, targetIntensity);
      return;
    }

    // WebGL Shader Setup
    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fluid domain-warped shader recreating "Icey Night Shards"
    const fsSource = `
      precision mediump float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_intensity;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 rot = mat2(0.87758, 0.47942, -0.47942, 0.87758);
        for (int i = 0; i < 4; ++i) {
          v += a * noise(p);
          p = rot * p * 2.05 + vec2(2.5, 3.1);
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);

        float t = u_time * 0.12;

        // Domain warping produces groovy organic liquid ripples
        vec2 q = vec2(fbm(p + vec2(0.0, t * 0.4)), fbm(p + vec2(4.2, 1.3 - t * 0.35)));
        vec2 r = vec2(fbm(p + 3.8 * q + vec2(1.7 - t * 0.25, 6.2)), fbm(p + 3.8 * q + vec2(7.3, 2.8 + t * 0.25)));
        float f = fbm(p + 3.2 * r);

        // Color palette: Neutral charcoal and deep obsidian foundation
        // Deep near-black void -> Charcoal surface -> Subtle neutral graphite edge
        vec3 cDark     = vec3(0.035, 0.035, 0.043); // #09090b void
        vec3 cNavy     = vec3(0.055, 0.055, 0.065); // #0e0e11 base
        vec3 cCobalt   = vec3(0.086, 0.086, 0.098); // #161619 surface
        vec3 cElectric = vec3(0.125, 0.125, 0.140); // #202024 graphite
        vec3 cIce      = vec3(0.220, 0.220, 0.245); // #38383e subtle neutral highlight

        float w1 = smoothstep(0.20, 0.54, f);
        float w2 = smoothstep(0.46, 0.74, f);
        float w3 = smoothstep(0.70, 0.94, f);

        vec3 color = mix(cDark, cNavy, w1);
        color = mix(color, cCobalt, w2);
        color = mix(color, cElectric, w3 * 0.5);

        // Ridge edge shimmer
        float ridge = 1.0 - abs(f - 0.56) * 2.8;
        ridge = clamp(ridge, 0.0, 1.0);
        color += cIce * pow(ridge, 3.5) * 0.08;

        // Subtle fine stippled shader grain
        float grain = (hash(gl_FragCoord.xy + fract(u_time * 0.05)) - 0.5) * 0.055;
        color += grain;

        // Gentle vignette
        float vig = 1.0 - length(uv - 0.5) * 0.55;
        color *= clamp(vig, 0.35, 1.0);

        gl_FragColor = vec4(color * u_intensity, 1.0);
      }
    `;

    function compileShader(type, source) {
      const s = gl.createShader(type);
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn(gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    }

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Full-screen quad
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1.0, -1.0,
         1.0, -1.0,
        -1.0,  1.0,
        -1.0,  1.0,
         1.0, -1.0,
         1.0,  1.0
      ]),
      gl.STATIC_DRAW
    );

    const posLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const intensityLoc = gl.getUniformLocation(program, 'u_intensity');

    gl.uniform1f(intensityLoc, targetIntensity);

    function resize() {
      // Use efficient 0.6x resolution for silky performance on all GPUs
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25) * 0.65;
      const w = Math.max(Math.floor(window.innerWidth * dpr), 320);
      const h = Math.max(Math.floor(window.innerHeight * dpr), 240);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
        gl.uniform2f(resLoc, w, h);
      }
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();

    let animId = null;
    let startTime = performance.now();

    function renderFrame(now) {
      const elapsed = isReducedMotion ? 12.0 : (now - startTime) * 0.001;
      gl.uniform1f(timeLoc, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      if (!isReducedMotion) {
        animId = requestAnimationFrame(renderFrame);
      }
    }

    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      isReducedMotion = e.matches;
      if (isReducedMotion && animId) {
        cancelAnimationFrame(animId);
        renderFrame(12000);
      } else if (!isReducedMotion) {
        startTime = performance.now();
        animId = requestAnimationFrame(renderFrame);
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (animId) cancelAnimationFrame(animId);
      } else if (!isReducedMotion) {
        startTime = performance.now();
        animId = requestAnimationFrame(renderFrame);
      }
    });

    renderFrame(performance.now());
  }

  function init2DFallback(canvas, container, isReducedMotion, intensity) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize, { passive: true });
    resize();

    let t = 0;
    function draw() {
      const w = canvas.width;
      const h = canvas.height;
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);

      const grad1 = ctx.createRadialGradient(
        w * (0.3 + 0.15 * Math.sin(t * 0.5)),
        h * (0.35 + 0.12 * Math.cos(t * 0.4)),
        10,
        w * 0.35,
        h * 0.4,
        w * 0.6
      );
      grad1.addColorStop(0, `rgba(32, 32, 36, ${0.4 * intensity})`);
      grad1.addColorStop(0.5, `rgba(22, 22, 26, ${0.2 * intensity})`);
      grad1.addColorStop(1, 'rgba(9, 9, 11, 0)');
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, w, h);

      const grad2 = ctx.createRadialGradient(
        w * (0.7 - 0.15 * Math.cos(t * 0.45)),
        h * (0.6 + 0.15 * Math.sin(t * 0.55)),
        10,
        w * 0.65,
        h * 0.6,
        w * 0.55
      );
      grad2.addColorStop(0, `rgba(28, 28, 32, ${0.35 * intensity})`);
      grad2.addColorStop(0.5, `rgba(18, 18, 22, ${0.15 * intensity})`);
      grad2.addColorStop(1, 'rgba(9, 9, 11, 0)');
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, w, h);

      if (!isReducedMotion) {
        t += 0.015;
        requestAnimationFrame(draw);
      }
    }
    draw();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAmbientShader);
  } else {
    initAmbientShader();
  }
})();
