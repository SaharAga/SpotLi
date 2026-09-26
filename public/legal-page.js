/*
 * Language switcher for the public legal pages (privacy.html, terms.html,
 * accessibility.html). External rather than inline so the CSP needs no
 * script-src 'unsafe-inline'. Each page carries its own strings in data-en /
 * data-he attributes, so this file holds no per-page text.
 */
(function () {
  function switchLang(lang) {
    document.getElementById('content-en').style.display = lang === 'en' ? 'block' : 'none';
    document.getElementById('content-he').style.display = lang === 'he' ? 'block' : 'none';
    ['page-title', 'page-updated'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.dataset[lang]) el.textContent = el.dataset[lang];
    });
    var buttons = document.querySelectorAll('.lang-btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('active', buttons[i].dataset.lang === lang);
    }
    document.documentElement.lang = lang;
  }

  var buttons = document.querySelectorAll('.lang-btn[data-lang]');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', function (event) {
      switchLang(event.currentTarget.dataset.lang);
    });
  }
})();
