/* Local/SSH stdio configuration only. No requests, accounts, or telemetry. */
(function () {
  'use strict';
  var launcher = '/var/jb/usr/libexec/privacy-monitor/launch-mcp';
  function validHost(host) {
    return typeof host === 'string' && host.length > 0 && host.length <= 253 && !host.startsWith('-') && /^[a-zA-Z0-9.:-]+$/.test(host);
  }
  function configuration(mode, host) {
    var server = { command: '/var/jb/bin/sh', args: [launcher] };
    if (mode === 'ssh') {
      host = String(host || '').trim();
      if (!validHost(host)) throw new Error('Enter the iPhone’s reachable IP or hostname, without a username, port, or URL scheme.');
      server = { command: 'ssh', args: ['-T', '-o', 'BatchMode=yes', 'mobile@' + host, '/var/jb/bin/sh', launcher] };
    } else if (mode !== 'local') throw new Error('Choose local or SSH setup.');
    return { mcpServers: { 'privacy-monitor': server } };
  }
  function command(client) {
    if (client === 'claude') return 'claude mcp add --scope user --transport stdio privacy-monitor -- /var/jb/bin/sh ' + launcher;
    if (client === 'codex') return 'codex mcp add privacy-monitor -- /var/jb/bin/sh ' + launcher;
    throw new Error('Choose Claude Code or Codex.');
  }
  globalThis.PrivacyMonitorConnect = { configuration: configuration, command: command, validHost: validHost };
  if (typeof document === 'undefined') return;
  var status = document.getElementById('pm-connect-status');
  var preview = document.getElementById('pm-config-preview');
  var input = document.getElementById('pm-ssh-host');
  function textFor(button) {
    var action = button.dataset.pmCopy;
    if (action === 'claude' || action === 'codex') return command(action);
    return JSON.stringify(configuration(action, input.value), null, 2);
  }
  document.querySelectorAll('[data-pm-copy]').forEach(function (button) {
    button.addEventListener('click', async function () {
      try {
        var text = textFor(button);
        preview.textContent = text;
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
          status.textContent = 'Select and copy the configuration shown below. Your browser does not provide clipboard access.';
          return;
        }
        await navigator.clipboard.writeText(text);
        status.textContent = 'Copied. Paste into the matching AI client or terminal. Nothing has connected or uploaded automatically.';
      } catch (error) {
        status.textContent = error.message || 'Copy failed. Select and copy the configuration below.';
      }
    });
  });
})();
