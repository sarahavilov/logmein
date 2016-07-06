/* globals self */
'use strict';

var credentials, logins;

function map (c) {
  let forms = Array.from(document.querySelectorAll('input[type=password]'))
    .map(p => p.form)
    .filter(f => f)
    .filter((f, i, l) => l.indexOf(f) === i);
  return forms.map(function (f) {
    return {
      get user () {
        return f.querySelector('[name="' + c.usernameField + '"]') ||
          Array.from(f.querySelectorAll('input:not([type=password]):not([disabled])'))
            .filter(i => (i.type === 'text' || i.type === 'email') && i.getBoundingClientRect().width).shift();
      },
      get pass () {
        return f.querySelector('[name="' + c.passwordField + '"]') ||
          Array.from(f.querySelectorAll('input[type=password]')).filter(i => {
            return i.getBoundingClientRect().width;
          }).shift();
      },
      form: f,
      credential: {
        user: c.username,
        pass: c.password
      }
    };
  }).filter(o => o.user || o.pass);
}

function submit (o) {
  if (o.user) {
    o.user.value = o.credential.user;
    o.user.dispatchEvent(new Event('change'));
    o.user.dispatchEvent(new Event('keydown'));
    o.user.dispatchEvent(new Event('keyup'));
    o.user.dispatchEvent(new Event('keychange'));
  }
  if (o.pass) {
    o.pass.value = o.credential.pass;
    o.pass.dispatchEvent(new Event('change'));
    o.pass.dispatchEvent(new Event('keydown'));
    o.pass.dispatchEvent(new Event('keyup'));
    o.pass.dispatchEvent(new Event('keychange'));
  }
  var button = o.form.querySelector('input[type=submit]') || o.form.querySelector('[type=submit]');
  if (button) {
    button.click();
  }
  else {
    var onsubmit = o.form.getAttribute('onsubmit');
    if (onsubmit && onsubmit.indexOf('return false') === -1) {
      o.form.onsubmit();
    }
    else {
      o.form.submit();
    }
  }
}

function choice () {
  var elems = credentials.map(map);
  elems = [].concat.apply([], elems);
  if (elems.length === 1) {
    submit(elems[0]);
  }
  if (elems.length > 1) {
    var pols = elems.filter(e => e.user && e.user.value === e.credential.user);
    if (pols.length) {
      pols.forEach(submit);
    }
    else {
      logins = elems;
      var colors = ['Red', 'Blue', 'Green', 'Yellow', 'Lime', 'DarkBlue', 'Purple', 'Magenta', 'Olive', 'Brown', 'Gray'];
      var forms = elems.map(e => e.form).filter((e, i, l) => l.indexOf(e) === i);
      elems.forEach(function (elem) {
        var i = forms.indexOf(elem.form);
        if (i === -1) {
          return;
        }
        if (elem.user) {
          elem.user.style['box-shadow'] = '0px 0px 3px ' + colors[i];
        }
        if (elem.pass) {
          elem.pass.style['box-shadow'] = '0px 0px 3px ' + colors[i];
        }
        if (elem.form) {
          elem.pass.style['box-shadow'] = '0px 0px 3px ' + colors[i];
        }
      });
      self.port.emit('select', elems.map(function (o) {
        var i = forms.indexOf(o.form);
        return o.credential.user[0].toUpperCase() + ' - [' + (i === -1 ? 'no-color' : colors[i]) + '] ' + o.credential.user;
      }));
    }
  }
}
self.port.on('choice', () => choice());

self.port.on('select-result', function (result) {
  submit(logins[result.value]);
});

function removeKey () {
  try {
    let key = document.getElementById('ilogin-button');
    if (key && key.parentNode) {
      key.parentNode.removeChild(key);
    }
  } catch (e) {}
}

function showKey () {
  let key = document.getElementById('ilogin-button');
  if (key) {
    removeKey();
  }
  key = document.createElement('div');
  key.setAttribute('id', 'ilogin-button');
  key.addEventListener('click', choice);
  document.body.appendChild(key);
  window.setTimeout(removeKey, self.options.timeout * 1000);
}

self.port.on('detach', removeKey);

function isLogIn (cs) {
  let passwords = Array.from(document.querySelectorAll('[type=password]'))
    .filter(e => e.getBoundingClientRect().width)
    .map(e => e.form).filter(f => f).length;
  if (passwords) {
    return true;
  }
  // Google like passwords
  // First look at the password fields
  for (let i = 0; i < cs.length; i++) {
    if (!cs[i].passwordField) {
      continue;
    }
    let ps = document.querySelectorAll('[name="' + cs[i].passwordField + '"]');
    for (let j = 0; j < ps.length; j++) {
      if (ps[j].form) {
        return true;
      }
    }
  }
  // now look at the username fields (Gmail)
  for (let i = 0; i < cs.length; i++) {
    if (!cs[i].usernameField) {
      continue;
    }
    let us = document.querySelectorAll('[name="' + cs[i].usernameField + '"]');
    for (let j = 0; j < us.length; j++) {
      if (us[j].form) {
        return true;
      }
    }
  }
}

self.port.on('credentials', function (cs) {
  credentials = cs;
  if (isLogIn(cs)) {
    showKey();
    self.port.emit('badge', cs.length);
  }
  else {
    self.port.emit('badge', 0);
  }
});

var count = 0;
var timer;
var observer;
function search () {
  if (!document || !document.location || !document.location.origin) {
    return;
  }
  let tmp = document.forms.length;
  if (tmp > count) {
    count = tmp;
    self.port.emit('get', {
      origin: document.location.origin
    });
  }
}

function obs () {
  if (observer) {
    return;
  }
  // dynamic loads
  observer = new MutationObserver(function () {
    window.clearTimeout(search);
    timer = window.setTimeout(search, 1000);
  });
  observer.observe(document.body, {
    attributes: false,
    childList: true,
    characterData: false
  });
  self.port.on('detach', () => observer.disconnect());
  search();
}

/* optimal loading */
function once () {
  if (document.hidden === true) {
    return;
  }
  document.removeEventListener('visibilitychange', once, false);
  obs();
}
function init () {
  document.removeEventListener('DOMContentLoaded', init);
  if (document.hidden === false && document.body) {
    obs();
  }
  else {
    document.addEventListener('visibilitychange', once, false);
    self.port.on('detach', () => {
      try {
        document.removeEventListener('visibilitychange', once, false);
      }
      catch (e) {}
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
}
else {
  init();
}
