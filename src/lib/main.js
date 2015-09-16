'use strict';

var pageMod = require('sdk/page-mod');
var self = require('sdk/self');
var passwords = require('sdk/passwords');
var platform = require('sdk/system').platform;
var tabs = require('sdk/tabs');
var timers = require('sdk/timers');
var url = require('sdk/url');
var sp = require('sdk/simple-prefs');
var notifications = require('sdk/notifications');
var array = require('sdk/util/array');
var events = require('sdk/system/events');
var {Cc, Ci} = require('chrome');
var {openDialog} = require('sdk/window/utils');
var {Hotkey} = require('sdk/hotkeys');
var {on, off, once, emit} = require('sdk/event/core');

var prompts = Cc['@mozilla.org/embedcomp/prompt-service;1']
  .getService(Ci.nsIPromptService);
var nsILoginManager = Cc['@mozilla.org/login-manager;1'].getService(Ci.nsILoginManager);

var desktop = ['winnt', 'linux', 'darwin'].indexOf(platform) !== -1;
var app = (function (a) {
  a.on = on.bind(null, a);
  a.once = once.bind(null, a);
  a.emit = emit.bind(null, a);
  a.removeListener = function removeListener (type, listener) {
    off(a, type, listener);
  };
  return a;
})({});

var workers = [];

// Log-Me-In is not going to ask for master password,
// instead it injects the button whenever master password is requested by Firefox itself
(function (inject) {
  if (nsILoginManager.isLoggedIn === true) {
    inject();
  }
  else {
    events.once('passwordmgr-crypto-login', inject);
  }
})(function () {
  pageMod.PageMod({
    include: ['http://*', 'https://*'],
    attachTo: ['existing', 'top', 'frame'],
    contentScriptWhen: 'start',
    contentScriptFile: self.data.url('inject/button.js'),
    contentStyleFile: self.data.url('inject/button.css'),
    contentScriptOptions: {
      timeout: sp.prefs.timeout
    },
    onAttach: function (worker) {
      array.add(workers, worker);
      worker.on('pageshow', function () { array.add(workers, this); });
      worker.on('pagehide', function () { array.remove(workers, this); });
      worker.on('detach', function () { array.remove(workers, this); });
      worker.port.on('get', function (obj) {
        passwords.search({
          url: obj.origin,
          onComplete: function onComplete (credentials) {
            if (sp.prefs.sort) {
              credentials = credentials.sort((a, b) => a.username > b.username);
            }
            worker.port.emit('credentials', credentials);
          }
        });
      });
      worker.port.on('select', function (array) {
        let selected = {};
        let result = prompts.select(
          null,
          'Multiple Logins available',
          'Color coded usernames:',
          array.length,
          array,
          selected
        );
        if (result) {
          worker.port.emit('select-result', selected);
        }
      });
      worker.port.on('badge', function (num) {
        app.emit('badge', {
          id: worker.tab.id,
          badge: num
        });
      });
    }
  });
});

if (desktop) {
  require('./desktop').attach(app);
}
app.on('password', function () {
  function gen(charset, length) {
    return Array.apply(null, new Array(length))
      .map(() => charset.charAt(Math.floor(Math.random() * charset.length)))
      .join('');
  }
  var pass = gen(sp.prefs['pass-charset'], sp.prefs['pass-length']);
  // clipboard is incompatible with Android
  var clipboard = require('sdk/clipboard');
  clipboard.set(pass, 'text');
  notifications.notify({
    iconURL: self.data.url('icons/64.png'),
    title: 'Log Me In',
    text: 'A random password is copied to your clipboard'
  });
});
app.on('window', function () {
  openDialog({
    url: 'chrome://passwordmgr/content/passwordManager.xul',
    features: 'chrome=yes,resizable=yes,toolbar=yes,centerscreen=yes,modal=no,dependent=no,dialog=no',
    args: {filterString: url.URL(tabs.activeTab.url).host}
  });
});

/* hotkey */
(function () {
  var key;
  function install () {
    if (sp.prefs.combo) {
      key = new Hotkey({
        combo: sp.prefs.combo,
        onPress: function () {
          workers.filter(w => w.tab === tabs.activeTab).forEach(w => w.port.emit('choice'));
        }
      });
    }
  }
  function destroy () {
    if (key) {
      key.destroy();
    }
  }
  install();
  sp.on('combo', function () {
    destroy();
    if (
      sp.prefs.combo.indexOf('shift') !== -1 ||
      sp.prefs.combo.indexOf('alt') !== -1 ||
      sp.prefs.combo.indexOf('meta') !== -1 ||
      sp.prefs.combo.indexOf('control') !== -1 ||
      sp.prefs.combo.indexOf('accel') !== -1 ||
      sp.prefs.combo.indexOf('pageup') !== -1 ||
      sp.prefs.combo.indexOf('pagedown') !== -1
    ) {
      if (sp.prefs.combo.split('-').filter(a => a).length >= 2) {
        install();
      }
    }
  });
})();

/* prefs */
sp.on('timeout', function () {
  if (sp.prefs.timeout < 10) {
    sp.prefs.timeout = 60;
  }
});

/* welcome */
exports.main = function (options) {
  if (options.loadReason === 'install' || options.loadReason === 'startup') {
    var version = sp.prefs.version;
    if (self.version !== version) {
      if (true) {
        timers.setTimeout(function () {
          tabs.open(
            'http://firefox.add0n.com/logmein.html?v=' + self.version +
            (version ? '&p=' + version + '&type=upgrade' : '&type=install')
          );
        }, 3000);
      }
      sp.prefs.version = self.version;
    }
  }
};
