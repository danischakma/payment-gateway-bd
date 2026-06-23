(function () {
  'use strict';

  var BASE_URL = document.currentScript
    ? document.currentScript.src.replace('/embed.js', '')
    : 'https://your-app.onrender.com';

  var style = document.createElement('style');
  style.textContent = [
    '.pg-btn{',
      'display:inline-flex;align-items:center;gap:8px;',
      'padding:12px 28px;',
      'background:linear-gradient(135deg,#e2136e,#c00f5c);',
      'color:#fff;border:none;border-radius:12px;',
      'font-family:"Hind Siliguri","Segoe UI",Tahoma,sans-serif;',
      'font-size:15px;font-weight:700;cursor:pointer;',
      'box-shadow:0 4px 20px rgba(226,19,110,0.4);',
      'transition:all 0.3s ease;',
    '}',
    '.pg-btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(226,19,110,0.6);}',
    '.pg-btn:active{transform:scale(0.97);}',
    '.pg-modal-overlay{',
      'position:fixed;inset:0;z-index:99999;',
      'background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);',
      'display:flex;align-items:center;justify-content:center;',
      'animation:pgFadeIn 0.25s ease;',
    '}',
    '.pg-modal{',
      'width:95%;max-width:440px;height:90vh;max-height:750px;',
      'border-radius:20px;overflow:hidden;position:relative;',
      'box-shadow:0 25px 60px rgba(0,0,0,0.4);',
      'animation:pgSlideIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275);',
    '}',
    '.pg-modal iframe{width:100%;height:100%;border:none;display:block;}',
    '.pg-close{',
      'position:absolute;top:12px;right:12px;z-index:1;',
      'width:32px;height:32px;border-radius:50%;',
      'background:rgba(0,0,0,0.3);border:none;',
      'color:#fff;font-size:16px;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'transition:background 0.2s;',
    '}',
    '.pg-close:hover{background:rgba(226,19,110,0.7);}',
    '@keyframes pgFadeIn{from{opacity:0}to{opacity:1}}',
    '@keyframes pgSlideIn{from{transform:scale(0.85) translateY(20px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}'
  ].join('');
  document.head.appendChild(style);

  function buildUrl(amount, product, method) {
    var q = '?';
    if (amount) q += 'amount=' + encodeURIComponent(amount) + '&';
    if (product) q += 'product=' + encodeURIComponent(product) + '&';
    if (method) q += 'method=' + encodeURIComponent(method);
    return BASE_URL + '/' + q;
  }

  function openModal(amount, product, method) {
    var overlay = document.createElement('div');
    overlay.className = 'pg-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'pg-modal';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'pg-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function () { document.body.removeChild(overlay); };

    var iframe = document.createElement('iframe');
    iframe.src = buildUrl(amount, product, method);
    iframe.allow = 'clipboard-write';

    modal.appendChild(iframe);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });

    return overlay;
  }

  function openTab(amount, product, method) {
    window.open(buildUrl(amount, product, method), '_blank');
  }

  document.querySelectorAll('[data-pg-button]').forEach(function (el) {
    var amount = el.getAttribute('data-pg-amount') || '';
    var product = el.getAttribute('data-pg-product') || '';
    var method = el.getAttribute('data-pg-method') || '';
    var mode = el.getAttribute('data-pg-mode') || 'modal';
    var label = el.getAttribute('data-pg-label') || '💳 পেমেন্ট করুন';

    var btn = document.createElement('button');
    btn.className = 'pg-btn';
    btn.innerHTML = label;
    btn.onclick = function () {
      if (mode === 'tab') openTab(amount, product, method);
      else openModal(amount, product, method);
    };
    el.appendChild(btn);
  });

  window.PaymentGateway = { open: openModal, openTab: openTab, baseUrl: BASE_URL };
})();
