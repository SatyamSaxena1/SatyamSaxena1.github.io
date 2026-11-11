if (typeof require === 'function') require('./privacy-monitor-connect.js');
(function () {
  var api = globalThis.PrivacyMonitorConnect;
  function assert(value, message) { if (!value) throw new Error(message); }
  var local = api.configuration('local').mcpServers['privacy-monitor'];
  assert(local.command === '/var/jb/bin/sh', 'local interpreter');
  assert(local.args[0] === '/var/jb/usr/libexec/privacy-monitor/launch-mcp', 'installed launcher');
  var ssh = api.configuration('ssh', ' 192.168.1.20 ').mcpServers['privacy-monitor'];
  assert(ssh.command === 'ssh' && ssh.args[3] === 'mobile@192.168.1.20', 'SSH destination');
  assert(ssh.args.indexOf('BatchMode=yes') >= 0 && ssh.args[ssh.args.length - 1] === local.args[0], 'key-based SSH launcher');
  ['', '-oProxyCommand', 'host;echo bad', 'https://host', 'mobile@host', 'host with space'].forEach(function (host) {
    var rejected = false;
    try { api.configuration('ssh', host); } catch (error) { rejected = true; }
    assert(rejected, 'unsafe or empty host must be rejected');
  });
  assert(api.command('claude').indexOf('--scope user --transport stdio') >= 0, 'Claude CLI options');
  assert(api.command('codex') === 'codex mcp add privacy-monitor -- /var/jb/bin/sh ' + local.args[0], 'Codex command');
  assert(api.command('claude').indexOf(local.args[0]) >= 0, 'consistent client launcher');
  var roundtrip = JSON.parse(JSON.stringify(api.configuration('ssh', 'iphone.local')));
  assert(roundtrip.mcpServers['privacy-monitor'].args[3] === 'mobile@iphone.local', 'valid JSON configuration');
  if (typeof console !== 'undefined') console.log('MCP connection config tests passed.');
})();
