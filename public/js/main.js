document.addEventListener('DOMContentLoaded', () => {
  const cards = document.querySelectorAll('.glass-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, i * 100);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  cards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease, box-shadow 0.3s ease';
    observer.observe(card);
  });

  document.querySelectorAll('input').forEach(input => {
    input.addEventListener('focus', () => {
      input.closest('.glass-card')?.style && (input.closest('.glass-card').style.boxShadow = '0 8px 40px rgba(108,99,255,0.3)');
    });
    input.addEventListener('blur', () => {
      input.closest('.glass-card')?.style && (input.closest('.glass-card').style.boxShadow = '');
    });
  });

  document.querySelectorAll('.pay-btn, .verify-btn').forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'linear-gradient(135deg, #8b5cf6 0%, #6c63ff 100%)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'linear-gradient(135deg, #6c63ff 0%, #8b5cf6 100%)';
    });
  });
});
