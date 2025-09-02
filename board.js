(async function(){
  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2,'0');
  const parseHM = s => { const [h,m]=s.split(':').map(Number); return h*60+m; };
  const inRange = (mins, start, end) => mins>=start && mins<end;
  const TZ = 'Europe/London';

  // Intl formatters (robust on iPad) — avoid Date string hacks
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
  const fmtDay = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday:'short' });
  const fmtMonth = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, month:'short' });
  function zonedParts(){
    const d = new Date();
    const parts = fmt.formatToParts(d);
    const hour = Number(parts.find(p=>p.type==='hour').value);
    const minute = Number(parts.find(p=>p.type==='minute').value);
    const second = Number(parts.find(p=>p.type==='second').value);
    const day = fmtDay.format(d);   // Sun, Mon, ...
    const month = fmtMonth.format(d); // Jan, Feb, ...
    return { hour, minute, second, day, month };
  }
  const minsOfDay = p => p.hour*60 + p.minute;

  // Load config
  const [messages, schedule, settings, sheets] = await Promise.all([
    fetch('config/messages.json').then(r=>r.json()),
    fetch('config/schedule.json').then(r=>r.json()),
    fetch('config/settings.json').then(r=>r.json()),
    fetch('config/sheets.json').then(r=>r.json()).catch(()=>({enabled:false}))
  ]);

  // Optional: Google Sheets advisories (first column, one per row)
  async function fetchSheetMessages(){
    if (!sheets || !sheets.enabled) return null;
    try{
      const url = `https://docs.google.com/spreadsheets/d/${sheets.sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheets.sheetName)}`;
      const resp = await fetch(url, {cache:'no-store'});
      if (!resp.ok) throw new Error('sheet fetch failed');
      const csv = await resp.text();
      const lines = csv.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
      return lines.map(row => row.split(',')[0]).filter(Boolean);
    }catch(e){
      console.warn('Sheets unavailable, using local messages.json', e);
      return null;
    }
  }
  const sheetMsgs = await fetchSheetMessages();
  const advisoriesBase = sheetMsgs && sheetMsgs.length ? sheetMsgs : messages.advisoriesBase.slice();

  // State
  let aCounter = (settings.innerStartOffsetMinutes||3) * 60;
  let bCounter = (settings.outerStartOffsetMinutes||8) * 60;
  let aCycle = 0, bCycle = 0;

  // Elements
  const headA_left = $('#headA_left');
  const headA_right = $('#headA_right');
  const headB_left = $('#headB_left');
  const headB_right = $('#headB_right');
  const advA = $('#advA');
  const advB = $('#advB');
  const clock = $('#clock');

  function serviceRunning(p){
    const m = minsOfDay(p);
    if (p.day === 'Sun') return inRange(m, parseHM(schedule.service.sun.start), parseHM(schedule.service.sun.end));
    return inRange(m, parseHM(schedule.service.mon_sat.start), parseHM(schedule.service.mon_sat.end));
  }
  function cutoffMin(p){
    return p.day === 'Sun' ? parseHM(schedule.service.sun.lastApproach) : parseHM(schedule.service.mon_sat.lastApproach);
  }
  function withinTermWindow(p){
    const m = minsOfDay(p), day = p.day;
    const w1 = ['Mon','Tue','Wed','Thu','Fri'].includes(day) && inRange(m, parseHM(schedule.terminations.weekday1.start), parseHM(schedule.terminations.weekday1.end));
    const w2 = ['Mon','Tue','Wed','Thu','Fri'].includes(day) && inRange(m, parseHM(schedule.terminations.weekday2.start), parseHM(schedule.terminations.weekday2.end));
    const sun = day==='Sun' && inRange(m, parseHM(schedule.terminations.sunday.start), parseHM(schedule.terminations.sunday.end));
    return w1 || w2 || sun;
  }
  function footballActive(p){
    if (p.day !== 'Sat') return false;
    if (!schedule.football.monthsInSeason.includes(p.month)) return false;
    const m = minsOfDay(p);
    return inRange(m, parseHM(schedule.football.start), parseHM(schedule.football.end));
  }

  function cycle(head, counter, leftEl, rightEl, cycleIdx, p){
    if (!serviceRunning(p)){
      leftEl.textContent = head + ' service complete';
      rightEl.textContent = '';
      leftEl.classList.remove('flashing');
      return [counter, cycleIdx];
    }
    if (counter > 0){
      if (counter <= (settings.approachingSeconds||10)){
        leftEl.textContent = head + ' approaching';
        leftEl.classList.add('flashing');
        rightEl.textContent = '';
      } else {
        leftEl.textContent = head + ' next arrival';
        leftEl.classList.remove('flashing');
        rightEl.textContent = Math.ceil(counter/60) + 'min';
      }
      counter--;
    } else {
      counter = (settings.headlineCycleMinutes||8) * 60;
      cycleIdx++;
    }
    if (minsOfDay(p) >= cutoffMin(p) && counter <= (settings.approachingSeconds||10)){
      leftEl.textContent = head + ' service complete';
      rightEl.textContent = '';
      leftEl.classList.remove('flashing');
      return [counter, cycleIdx];
    }
    return [counter, cycleIdx];
  }

  function rotateAdvisories(p){
    let listA = advisoriesBase.slice();
    let listB = advisoriesBase.slice();
    if (footballActive(p)){
      listA.push(messages.football);
      listB.push(messages.football);
    }
    if (withinTermWindow(p)){
      if (aCycle % 3 === 2) listA.push(messages.terminations.inner);
      if (bCycle % 3 === 2) listB.push(messages.terminations.outer);
    }
    const idx = Math.floor(Date.now()/10000);
    setAdv(advA, listA[idx % listA.length]);
    setAdv(advB, listB[idx % listB.length]);
  }

  function setAdv(el, msg){
    el.textContent = msg;
    const scroller = el.closest('.scroll');
    const marquee = el.closest('.marquee');
    if (scroller.scrollWidth > marquee.clientWidth){
      scroller.style.animation = `scroll-left ${(settings.marqueeSpeedSeconds||12)}s linear infinite`;
    } else {
      scroller.style.animation = 'none';
    }
  }

  function updateClock(p){
    clock.textContent = 'Time Now ' + [pad(p.hour), pad(p.minute), pad(p.second)].join(':');
  }

  // Main tick
  setInterval(()=>{
    const p = zonedParts();
    [aCounter, aCycle] = cycle('Inner', aCounter, headA_left, headA_right, aCycle, p);
    [bCounter, bCycle] = cycle('Outer', bCounter, headB_left, headB_right, bCycle, p);
    rotateAdvisories(p);
    updateClock(p);
  }, 1000);

  // Initial paint
  const p0 = zonedParts();
  rotateAdvisories(p0);
  updateClock(p0);
})();