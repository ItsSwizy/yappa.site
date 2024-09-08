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
