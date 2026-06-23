(function () {
  'use strict';

  var BASE_URL = '__BASE_URL__';

  var style = document.createElement('style');
  style.textContent = [
    '.pg-btn{',
      'display:inline-flex;align-items:center;gap:8px;',
      'padding:12px 24px;',
      'background:linear-gradient(135deg,#6c63ff,#8b5cf6);',
      'color:#fff;border:none;border-radius:12px;',
      'font-family:"Segoe UI",Tahoma,Geneva,Verdana,sans-serif;',
      'font-size:16px;font-weight:600;cursor:pointer;',
      'box-shadow:0 4px 20px rgba(108,99,255,0.4);',
      'transition:all 0.3s ease;',
    '}',
    '.pg-btn:hover{transform:translateY(-2px);box-shadow:0 8px 30px rgba(108,99,255,0.6);}',
    '.pg-btn:active{transform:scale(0.97);}',
    '.pg-modal-overlay{',
      'position:fixed;inset:0;z-index:99999;',
      'background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);',
      'display:flex;align-items:center;justify-content:center;',
      'animation:pgFadeIn 0.3s ease;',
    '}',
    '.pg-modal{',
      'width:90%;max-width:480px;height:85vh;',
      'border-radius:20px;overflow:hidden;',
      'box-shadow:0 20px 60px rgba(0,0,0,0.5);',
      'animation:pgSlideIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275);',
    '}',
    '.pg-modal iframe{width:100%;height:100%;border:none;}',
    '.pg-close{',
      'position:absolute;top:16px;right:16px;',
      'width:36px;height:36px;border-radius:50%;',
      'background:rgba(255,255,255,0.15);border:none;',
      'color:#fff;font-size:18px;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;',
      'transition:background 0.2s;',
    '}',
    '.pg-close:hover{background:rgba(255,107,107,0.5);}',
    '@keyframes pgFadeIn{from{opacity:0}to{opacity:1}}',
    '@keyframes pgSlideIn{from{transform:scale(0.8) translateY(30px);opacity:0}to{transform:scale(1) translateY(0);opacity:1}}'
  ].join('');
  document.head.appendChild(style);

  function openModal(amount, email, method) {
    var overlay = document.createElement('div');
    overlay.className = 'pg-modal-overlay';

    var modal = document.createElement('div');
    modal.className = 'pg-modal';
    modal.style.position = 'relative';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'pg-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = function () { document.body.removeChild(overlay); };

    var iframe = document.createElement('iframe');
    iframe.src = BASE_URL + '/?embed=1' +
      (amount ? '&amount=' + encodeURIComponent(amount) : '') +
      (email ? '&email=' + encodeURIComponent(email) : '') +
      (method ? '&method=' + encodeURIComponent(method) : '');
    iframe.allow = 'clipboard-write';

    modal.appendChild(iframe);
    modal.appendChild(closeBtn);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  function openNewTab(amount, email, method) {
    var url = BASE_URL + '/' +
      '?amount=' + (amount || '') +
      '&email=' + (email || '') +
      '&method=' + (method || 'bkash');
    window.open(url, '_blank');
  }

  document.querySelectorAll('[data-pg-button]').forEach(function (el) {
    var amount = el.getAttribute('data-pg-amount') || '';
    var email = el.getAttribute('data-pg-email') || '';
    var method = el.getAttribute('data-pg-method') || 'bkash';
    var mode = el.getAttribute('data-pg-mode') || 'modal';
    var label = el.getAttribute('data-pg-label') || '💳 পেমেন্ট করুন';

    var btn = document.createElement('button');
    btn.className = 'pg-btn';
    btn.innerHTML = label;
    btn.onclick = function () {
      if (mode === 'tab') openNewTab(amount, email, method);
      else openModal(amount, email, method);
    };
    el.appendChild(btn);
  });

  window.PaymentGateway = {
    open: openModal,
    openTab: openNewTab,
    BASE_URL: BASE_URL
  };
})();
