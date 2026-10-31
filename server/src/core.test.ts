import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nameTagFor } from './bot';
import { CredentialCodec } from './credential';
import { Store } from './db';
import { Presence } from './presence';
import { DESK_LABELS, parseLabel } from './seats';

const KEY = 'a'.repeat(64);

function tempStore(): Store {
  return new Store(':memory:');
}

test('24 desk labels, no meeting/lounge seats', () => {
  assert.equal(DESK_LABELS.length, 24);
  assert.ok(DESK_LABELS.every((l) => /^[A-E][1-6]$/.test(l)));
});

test('parseLabel normalises case, spaces and Persian/Arabic digits', () => {
  assert.equal(parseLabel(' a1 '), 'A1');
  assert.equal(parseLabel('B ۳'), 'B3');
  assert.equal(parseLabel('c٢'), 'C2');
  assert.equal(parseLabel('desk-E4'), 'E4');
  assert.equal(parseLabel('E9'), null);
  assert.equal(parseLabel('meeting-small-1'), null);
});

test('credential round-trips and rejects tampering', () => {
  const codec = new CredentialCodec(KEY);
  const token = codec.encode({ userId: '42', version: 3 });
  assert.deepEqual(codec.decode(token), { userId: '42', version: 3 });
  const raw = Buffer.from(token, 'base64url');
  raw[raw.length - 1] ^= 1;
  assert.equal(codec.decode(raw.toString('base64url')), null);
  assert.equal(new CredentialCodec('b'.repeat(64)).decode(token), null);
});

test('name tag: username, else first 14 chars of display name', () => {
  assert.equal(nameTagFor({ id: 1, username: 'yashar', first_name: 'Yashar' }), 'yashar');
  assert.equal(nameTagFor({ id: 1, first_name: 'Abcdefghijklmnop', last_name: 'Q' }), 'Abcdefghijklmn');
  assert.equal(nameTagFor({ id: 1, first_name: 'علی', last_name: 'رضایی' }), 'علی رضایی');
});

test('seat assignment is exclusive; ban frees the seat', () => {
  const store = tempStore();
  for (const id of ['1', '2']) store.upsertProfile({ userId: id, chatId: id, username: null, displayName: id, nameTag: id });
  assert.equal(store.assignSeat('1', 'A1'), true);
  assert.equal(store.assignSeat('2', 'A1'), false);
  assert.equal(store.assignSeat('1', 'A2'), false, 'already seated');
  assert.equal(store.ban('1'), 'A1');
  assert.equal(store.assignSeat('2', 'A1'), true);
});

test('presence: working → busy → stop → idle → away', () => {
  const store = tempStore();
  store.upsertProfile({ userId: '1', chatId: '1', username: 'u', displayName: 'u', nameTag: 'u' });
  store.assignSeat('1', 'B2');
  let now = new Date('2026-11-01T06:00:00Z'); // 09:30 Tehran
  const presence = new Presence(store, () => now);

  assert.equal(presence.snapshot().seats[0].state, 'away');

  presence.record('1', 'claude', 'prompt');
  let s = presence.snapshot().seats[0];
  assert.equal(s.state, 'working');
  assert.equal(s.busy, true);
  assert.equal(s.tool, 'claude');
  assert.equal(s.seatId, 'desk-B2');

  presence.record('1', 'claude', 'stop');
  assert.equal(presence.snapshot().seats[0].busy, false);

  now = new Date(now.getTime() + 6 * 60_000);
  assert.equal(presence.snapshot().seats[0].state, 'idle');

  // Persistence is throttled, but a different tool is always written through.
  presence.record('1', 'codex', 'tool');
  assert.equal(store.getUser('1')!.last_tool, 'codex');

  now = new Date('2026-11-01T21:00:00Z'); // 00:30 next day, Tehran
  s = presence.snapshot().seats[0];
  assert.equal(s.state, 'away');
  assert.equal(s.tool, null);
});
