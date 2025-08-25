// Example: Toggle mobile menu
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('nav');

if (menuToggle && nav) {
    menuToggle.addEventListener('click', () => {
        nav.classList.toggle('active');
    });
}

// Example: Responsive image loading
function loadResponsiveImages() {
    const images = document.querySelectorAll('img[data-src]');
    images.forEach(img => {
        if (window.innerWidth <= 768) {
            img.src = img.dataset.mobileSrc || img.dataset.src;
        } else {
            img.src = img.dataset.src;
        }
    });
}

window.addEventListener('load', loadResponsiveImages);
window.addEventListener('resize', loadResponsiveImages);

// Contact form functions
function openContactForm() {
    document.getElementById('contactFormOverlay').style.display = 'block';
}

function closeContactForm() {
    document.getElementById('contactFormOverlay').style.display = 'none';
}

// Close form when clicking outside
window.onclick = function(event) {
    if (event.target == document.getElementById('contactFormOverlay')) {
        closeContactForm();
    }
}

// Advanced Glass Morphism Effects
class GlassMorphism {
    constructor() {
        this.nav = document.querySelector('nav');
        this.init();
    }

    init() {
        if (!this.nav) return;
        
        // Add dynamic blur based on scroll
        this.addScrollBlur();
        
        // Add mouse parallax effect
        this.addMouseParallax();
        
        // Add dynamic lighting
        this.addDynamicLighting();
    }

    addScrollBlur() {
        let ticking = false;
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    const scrolled = window.pageYOffset;
                    const blurAmount = Math.min(25 + (scrolled * 0.1), 35);
                    const opacity = Math.max(0.03 - (scrolled * 0.0001), 0.01);
                    
                    this.nav.style.setProperty('--scroll-blur', `${blurAmount}px`);
                    this.nav.style.setProperty('--scroll-opacity', opacity);
                    ticking = false;
                });
                ticking = true;
            }
        });
    }

    addMouseParallax() {
        // Removed 3D movement effect for cleaner interaction
    }

    addDynamicLighting() {
        // Create dynamic light source
        const lightSource = document.createElement('div');
        lightSource.className = 'dynamic-light';
        lightSource.style.cssText = `
            position: absolute;
            width: 200px;
            height: 200px;
            background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
            pointer-events: none;
            z-index: -3;
            transition: all 0.3s ease;
        `;
        
        this.nav.appendChild(lightSource);
        
        // Move light with mouse
        this.nav.addEventListener('mousemove', (e) => {
            const rect = this.nav.getBoundingClientRect();
            const x = e.clientX - rect.left - 100;
            const y = e.clientY - rect.top - 100;
            
            lightSource.style.left = `${x}px`;
            lightSource.style.top = `${y}px`;
        });
    }
}

// Initialize glass morphism effects
document.addEventListener('DOMContentLoaded', () => {
    new GlassMorphism();
});

// Add CSS custom properties for dynamic effects
const style = document.createElement('style');
style.textContent = `
    nav {
        --scroll-blur: 35px;
        --scroll-opacity: 0.02;
        backdrop-filter: blur(var(--scroll-blur)) saturate(1.4) contrast(1.1);
        -webkit-backdrop-filter: blur(var(--scroll-blur)) saturate(1.4) contrast(1.1);
    }
    
    nav::before {
        opacity: var(--scroll-opacity);
    }
    
    .dynamic-light {
        animation: lightPulse 4s ease-in-out infinite;
    }
    
    @keyframes lightPulse {
        0%, 100% { opacity: 0.4; transform: scale(1); }
        50% { opacity: 0.6; transform: scale(1.1); }
    }
`;
document.head.appendChild(style);
