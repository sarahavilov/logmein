/* globals self */
'use strict';

var credentials, logins;

function map (c) {
  let ps = document.querySelectorAll('[name="' + c.usernameField + '"]');
  if (!ps.length) {
    ps = document.querySelectorAll('[name="' + c.passwordField + '"]');
  }
  let forms = [].map.call(ps, p => p.form).filter(f => f);
  return forms.map(function (f) {
    return {
      user: f.querySelector('[name="' + c.usernameField + '"]'),
      pass: f.querySelector('[name="' + c.passwordField + '"]'),
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
  }
  if (o.pass) {
    o.pass.value = o.credential.pass;
  }
  var onsubmit = o.form.getAttribute('onsubmit');
  if (onsubmit && onsubmit.indexOf('return false') === -1) {
    o.form.onsubmit();
  }
  else {
    o.form.submit();
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
      });
      self.port.emit('select', elems.map(function (o) {
        var i = forms.indexOf(o.form);
        return '[' + (i === -1 ? 'no-color' : colors[i]) + '] ' + o.credential.user;
      }));
    }
  }
}
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

function search () {
  if (!document || !document.location) {
    return;
  }
  self.port.emit('get', {
    origin: document.location.origin
  });
  document.removeEventListener('DOMContentLoaded', search, false);
}
if (document.readyState === 'loading') {
  if (document.body) {
    search();
  }
  else {
    document.addEventListener('DOMContentLoaded', search, false);
  }
}
else {
  search();
}
