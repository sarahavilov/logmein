'use strict';

var {ToggleButton} = require('sdk/ui/button/toggle');
var panels = require('sdk/panel');
var self = require('sdk/self');
var tabs = require('sdk/tabs');

var app;

var button = new ToggleButton({
  id: 'logmein',
  label: 'Log Me In',
  icon: {
    '16': './icons/16.png',
    '32': './icons/32.png',
    '64': './icons/64.png'
  },
  onChange: function (state) {
    if (state.checked) {
      panel.show({
        position: button
      });
    }
  }
});

var panel = panels.Panel({
  contentURL: self.data.url('panel/index.html'),
  contentScriptFile: self.data.url('panel/index.js'),
  width: 250,
  height: 130,
  onHide: function () {
    button.state('window', {checked: false});
  }
});
panel.port.on('password', () => app.emit('password'));
panel.port.on('window', () => app.emit('window'));

exports.attach = function (a) {
  app = a;
  app.on('badge', function (obj) {
    badges[obj.id] = obj.badge;
    update();
  });
};

var badges = {};

function update () {
  let id = tabs.activeTab.id;
  button.badge = badges[id] ? badges[id] : '';
}
tabs.on('activate', update);
