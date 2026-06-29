const DEFAULT_TRACK_OPTIONS = Object.freeze({
  startX: 630,
  startYBase: 480,
  startYRange: 10,
  minDuration: 300,
  durationRange: 400,
  minStep: 5,
  stepRange: 5,
  now: () => Date.now(),
  random: () => Math.random()
});

export function generateMouseTrack(distance, options = {}) {
  const settings = { ...DEFAULT_TRACK_OPTIONS, ...options };
  const randomInt = (range) => Math.floor(settings.random() * range);
  const startX = settings.startX;
  const startY = settings.startYBase + randomInt(settings.startYRange);
  const startTime = settings.now();
  const totalDuration = settings.minDuration + randomInt(settings.durationRange);
  const track = [{ x: startX, y: startY, t: startTime }];

  for (let x = settings.minStep + randomInt(settings.stepRange); x < distance; x += settings.minStep + randomInt(settings.stepRange)) {
    track.push({
      x: startX + x,
      y: startY + randomInt(4) - 2,
      t: startTime + Math.floor((x * totalDuration) / distance)
    });
  }

  track.push({ x: startX + distance, y: startY, t: startTime + totalDuration });
  return track;
}

export function buildVerifyPayload({ rtk, instanceId, mouseTrack, userAgent, now = () => Date.now() }) {
  const extend = {
    appName: 'Netscape',
    userAgent,
    appVersion: userAgent
  };
  const body = new URLSearchParams();
  body.set('type', 'verify');
  body.set('rtk', rtk);
  body.set('time', String(now()));
  body.set('mt', Buffer.from(JSON.stringify(mouseTrack)).toString('base64'));
  body.set('instanceId', instanceId);
  body.set('extend', Buffer.from(JSON.stringify(extend)).toString('base64'));
  return body;
}
