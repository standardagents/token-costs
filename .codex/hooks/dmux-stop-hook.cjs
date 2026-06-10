#!/usr/bin/env node
const fs = require('fs');

function finish(payload = {}) {
  process.stdout.write(JSON.stringify(payload));
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  input += chunk;
});
process.stdin.on('end', () => {
  let payload = {};
  try {
    payload = input.trim() ? JSON.parse(input) : {};
  } catch (error) {
    payload = { parse_error: String(error), raw: input };
  }

  const event = {
    source: 'codex-stop-hook',
    dmuxPaneId: process.env.DMUX_PANE_ID || '',
    tmuxPaneId: process.env.DMUX_TMUX_PANE_ID || '',
    hookEventName: payload.hook_event_name || payload.hookEventName || '',
    turnId: payload.turn_id || payload.turnId || '',
    stopHookActive: payload.stop_hook_active === true || payload.stopHookActive === true,
    lastAssistantMessage: payload.last_assistant_message || null,
    transcriptPath: payload.transcript_path || null,
    cwd: payload.cwd || process.cwd(),
    timestamp: Date.now()
  };

  if (event.hookEventName && event.hookEventName !== 'Stop') {
    finish();
    return;
  }

  const eventFile = process.env.DMUX_CODEX_HOOK_EVENT_FILE || '';
  if (!event.dmuxPaneId || !eventFile) {
    finish();
    return;
  }

  try {
    fs.writeFileSync(eventFile, JSON.stringify(event, null, 2));
  } catch (error) {
    finish();
    return;
  }

  finish();
});
