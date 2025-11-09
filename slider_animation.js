// slider_animation.js - Animación de fondo tipo plexus para el Slider

(function () {

  // Configuración
  const config = {
    particleCount: 80,      // Cantidad de partículas (aumentada para plexus)
    particleSize: 2,        // Tamaño base de las partículas (reducido para plexus)
    baseSpeed: 0.3,         // Velocidad base (más lento para plexus)
    addedSpeed: 0.8,        // Velocidad adicional
    connectDistance: 150,   // Distancia máxima para conectar partículas (aumentada)
    connectOpacity: 0.35,   // Opacidad máxima de las conexiones (reducida para más sutileza)
    hueBase: 160,           // Color base (160 = cyan-verdoso)
    hueRange: 80,           // Rango de variación del color (aumentado)
    pulseSpeed: 0.002,      // Velocidad de pulsación (más lento)
    responsive: true,       // Ajustar para dispositivos móviles
    lineWidth: 0.6,         // Grosor de líneas para el efecto plexus
    nodeSize: 1.5,          // Tamaño de los nodos (más pequeños)
    nodeBrightness: 0.4,    // Brillo de los nodos (reducido para enfatizar conexiones)
    sliderDriftStrength: 40, // Intensidad de la deriva al mover el slider
    sliderDriftDecay: 0.9,   // Qué tan rápido se disipa la deriva
    sliderDriftMax: 6        // Límite de velocidad de deriva
  };


  // Crear canvas y añadirlo al DOM
  function createCanvas() {
    const canvas = document.createElement('canvas');
    canvas.id = 'animation-bg';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1';
    canvas.style.opacity = '0.6'; // Aumentamos la opacidad para el efecto plexus
    canvas.style.pointerEvents = 'none'; // No interfiere con los clics
    document.body.prepend(canvas);
    return canvas;
  }


  // Inicializar animación
  function initAnimation() {
    // Detectar preferencias de reducción de movimiento
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      console.log('Animación reducida por preferencias de usuario');
      config.particleCount = Math.floor(config.particleCount / 2);
      config.baseSpeed = config.baseSpeed / 2;
      config.pulseSpeed = config.pulseSpeed / 2;
    }

    // Detectar dispositivos móviles y tablets
    const isMobile = window.innerWidth < 768;
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

    if (isMobile && config.responsive) {
      // Configuración para móviles
      config.particleCount = Math.floor(config.particleCount * 0.4); // Reducir más partículas
      config.connectDistance = Math.floor(config.connectDistance * 0.6); // Menos conexiones
      config.lineWidth = config.lineWidth * 0.8;
    } else if (isTablet && config.responsive) {
      // Configuración para tablets
      config.particleCount = Math.floor(config.particleCount * 0.7); // Reducción moderada
      config.connectDistance = Math.floor(config.connectDistance * 0.8); // Menos conexiones
      config.lineWidth = config.lineWidth * 0.9;
    }

    const canvas = createCanvas();
    const ctx = canvas.getContext('2d');
    const particles = [];
    let width, height;
    let animationFrame;
    let sliderValue = 0;
    let sliderDriftVelocity = 0;

    // Función para redimensionar el canvas
    function resizeCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    }

    // Clase Partícula
    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.size = Math.random() * config.particleSize + 1;
        this.speedX = (Math.random() * config.addedSpeed - (config.addedSpeed / 2)) * config.baseSpeed;
        this.speedY = (Math.random() * config.addedSpeed - (config.addedSpeed / 2)) * config.baseSpeed;
        this.hue = config.hueBase + Math.random() * config.hueRange;
      }

      update(driftX = 0, driftY = 0) {
        // Actualizar posición
        this.x += this.speedX + driftX;
        this.y += this.speedY + driftY;

        // Rebotar en los bordes
        if (this.x < 0 || this.x > width) this.speedX *= -1;
        if (this.y < 0 || this.y > height) this.speedY *= -1;

        // Reiniciar si está fuera de los límites
        if (this.x < -50 || this.x > width + 50 || this.y < -50 || this.y > height + 50) {
          this.reset();
        }
      }

      draw() {
        // Para efecto plexus, los puntos son más sutiles
        const glow = Math.sin(Date.now() * config.pulseSpeed) * 0.5 + 0.5;
        const size = config.nodeSize * (1 + glow * 0.2);

        // Solo dibujamos un pequeño punto para los nodos
        ctx.beginPath();
        ctx.arc(this.x, this.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 100%, 70%, ${config.nodeBrightness + glow * 0.1})`;
        ctx.fill();
      }
    }

    // Crear partículas
    function createParticles() {
      particles.length = 0; // Limpiar partículas existentes
      for (let i = 0; i < config.particleCount; i++) {
        particles.push(new Particle());
      }
    }

    // Función para conectar partículas (efecto plexus)
    function connectParticles() {
      const connections = [];
      
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Solo conectamos partículas cercanas
          if (distance < config.connectDistance) {
            // La opacidad se reduce con la distancia
            const opacity = (1 - distance / config.connectDistance) * config.connectOpacity;
            
            // El color depende del valor del slider y las partículas conectadas
            const avgHue = (particles[i].hue + particles[j].hue) / 2;
            // Modificar el color basado en el valor del slider
            const hue = (avgHue + sliderValue * 60) % 360;
            
            connections.push({
              p1: particles[i],
              p2: particles[j],
              opacity,
              distance,
              hue
            });
          }
        }
      }

      // Dibujamos las conexiones
      for (const conn of connections) {
        ctx.beginPath();
        ctx.moveTo(conn.p1.x, conn.p1.y);
        ctx.lineTo(conn.p2.x, conn.p2.y);

        // Variamos el brillo según la distancia para dar más profundidad
        const brightness = 60 - (conn.distance / config.connectDistance * 20);
        ctx.strokeStyle = `hsla(${conn.hue}, 100%, ${brightness}%, ${conn.opacity})`;
        ctx.lineWidth = config.lineWidth;
        ctx.stroke();
      }
    }

    // Loop de animación
    function animate() {
      // Limpiamos el canvas con un poco de rastro para dar efecto de movimiento suave
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, width, height);

      // Calculamos la deriva basada en el movimiento del slider
      sliderDriftVelocity *= config.sliderDriftDecay;
      const driftX = Math.max(-config.sliderDriftMax, Math.min(config.sliderDriftMax, sliderDriftVelocity));
      
      // Ajustamos el color base según el valor del slider
      const hueShift = sliderValue * 120; // Rota el tono basado en el valor del slider
      
      // Actualizamos cada partícula con la deriva
      particles.forEach(p => {
        p.update(driftX, 0);
        // Ajustar el color de las partículas basado en el slider
        p.hue = (config.hueBase + hueShift + Math.random() * config.hueRange) % 360;
        p.draw();
      });
      
      // Conectamos las partículas (efecto plexus)
      connectParticles();

      animationFrame = requestAnimationFrame(animate);
    }

    // Escuchar cambios en el slider para afectar la animación
    function listenToSlider() {
      const slider = document.getElementById('slider');
      if (slider) {
        sliderValue = parseFloat(slider.value) || 0;
        
        // Evento input para actualización en tiempo real
        slider.addEventListener('input', () => {
          const newValue = parseFloat(slider.value) || 0;
          const delta = newValue - sliderValue;
          sliderValue = newValue;
          
          // Aplicamos más fuerza al movimiento de las partículas según la rapidez del deslizamiento
          sliderDriftVelocity += delta * config.sliderDriftStrength;
          sliderDriftVelocity = Math.max(-config.sliderDriftMax, Math.min(config.sliderDriftMax, sliderDriftVelocity));
          
          // Actualizamos color de partículas basado en el valor
          particles.forEach(p => {
            // Cambia ligeramente el tono de cada partícula según el valor del slider
            p.hue = (config.hueBase + (sliderValue * 120) + Math.random() * config.hueRange) % 360;
          });
        });
        
        // Evento change cuando se suelta el slider
        slider.addEventListener('change', () => {
          sliderValue = parseFloat(slider.value) || sliderValue;
        });
      }
    }

    // Iniciar animación
    resizeCanvas();
    createParticles();
    animate();
    listenToSlider();

    // Manejar cambios de tamaño de ventana
    window.addEventListener('resize', () => {
      resizeCanvas();

      // Ajustar la cantidad de partículas y conexiones según el nuevo tamaño
      const isMobile = window.innerWidth < 768;
      const isTablet = window.innerWidth >= 768 && window.innerWidth < 1024;

      // Recrear partículas con la configuración adecuada para el nuevo tamaño
      if (isMobile && config.responsive) {
        config.particleCount = Math.floor(80 * 0.4); // Base * factor móvil
        config.connectDistance = Math.floor(150 * 0.6); // Base * factor móvil
      } else if (isTablet && config.responsive) {
        config.particleCount = Math.floor(80 * 0.7); // Base * factor tablet
        config.connectDistance = Math.floor(150 * 0.8); // Base * factor tablet
      } else {
        config.particleCount = 80; // Valor base para desktop
        config.connectDistance = 150; // Valor base para desktop
      }
      
      // Recrear partículas con el nuevo tamaño
      createParticles();
    });
  }

  // Iniciar animación cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimation);
  } else {
    initAnimation();
  }
})();